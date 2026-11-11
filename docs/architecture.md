# アーキテクチャ — 改訂2

原則: **依存は内側（ドメイン）へ向け、その向きはコンパイラに守らせる / 外界との接点は狭いインターフェース越し / 1モジュール1責務 / 純粋なロジックとユースケースはテストで固める / 拡張は「足す」だけで済む形に / 契約は実例（フィクスチャ）で機械的に検査する**。
過剰な抽象化はしない。差し替えや単体テストに本当に必要な継ぎ目にだけインターフェースを置く。

## Rust（src-tauri/）: クレートで分けたポートとアダプタ

```
src-tauri/
  Cargo.toml                   ワークスペース ＋ 本体クレート agent-guild（infrastructure / interface / bootstrap）
  rustfmt.toml, clippy.toml    整形の設定（幅120）と clippy の閾値
  crates/
    guild-domain/              純粋なモデルとルール（I/O なし）
    guild-application/         ユースケースとポート（domain だけに依存）
    runner-client/             sidecar の起動・監視・stdio プロトコル（本体にも domain にも依存しない）
    arch-harness/              本体クレートの構造と各クレートの依存を検査するテスト専用クレート（publish = false）
  src/
    main.rs, lib.rs            エントリと Tauri Builder（プラグイン登録・コマンド登録・setup で bootstrap を呼ぶ）
    bootstrap/                 composition root: データフォルダ決定 → ロック → DB → ランナー → サービス組み立て → 初期データ → スケジューラ。失敗したら復旧モード
      paths.rs                 データフォルダの場所の決定
      boot.rs                  データフォルダを開く（ロック → guild-data.json → DB）。失敗したら復旧モードの理由を返す
      assemble.rs              サービスの組み立て（通常時と、保存先の操作だけの復旧モード）
      seed.rs                  初期データ（初回だけ）
      scheduler.rs             自発活動のスケジューラ（30秒ごと）
    infrastructure/            ports の実装
      sqlite/                  接続・マイグレーション（0001）・各リポジトリ・meta
      runtime/                 AgentRuntime を runner-client で実装（Launch の組み立てもここ）
      workspace.rs             作業場所（work/・state/ の用意、MEMORY.md、削除の再試行、ファイラで開く）
      attachments.rs           発言に添えた画像・ファイルの置き場所（attachments/<channelId>/<id>.<拡張子>。ID は data_dir.rs の safe_component を通す）
      skill_library.rs         スキルライブラリのフォルダの走査と SKILL.md の読み取り（読むだけで書き換えない）
      events.rs                EventPublisher を Tauri の emit で実装
      settings.rs              settings.json（version 付き・未知フィールド保持）
      data_dir.rs              guild-data.json（ギルドのデータである印）と .lock（多重起動防止）、ID をフォルダ名にするときの safe_component
      export.rs                今のデータの書き出し（VACUUM INTO とフォルダのコピー）
      folders.rs, file_manager.rs  保存先の候補の調査と、OS のファイラで開くこと
      logging.rs               ログの出し先（配布版は <app_log_dir>/agent-guild.log）
      spawner.rs               タスクの生成（Tauri の非同期ランタイムの上で動かす）
      app_control.rs           再起動
      clock.rs, ids.rs         SystemClock（現在日時の表示用文字列も）、UuidGenerator
    interface/
      commands/                Tauri コマンド（薄い）: 引数 → サービス → CommandError（open_url と choose_folder は OS の機能を直接呼ぶ）
      state.rs                 Tauri の State として持つもの（通常時は AppServices、復旧モードでは BootStatus と最小限のサービス）
```

### guild-domain（依存: serde, serde_json, unicode-normalization のみ）
- `ids`（ニュータイプ AgentId / ChannelId / MessageId / SkillId / AttachmentId / DelegationId / SubtaskId）、`author`（`Author { Human, System, Agent }`・`MemberId { Human, Agent }`。JSON では "me" / "system" / UUID）
- `agent/`（Agent・AgentInput・UnmentionedPolicy・**templates.rs**（作成のテンプレート表。design.md §2）・権限・タグと名前の正規化と検証）
- `channel`, `message`（Message・MessageKind・NewMessage）, `attachment`（発言に添えた画像・ファイル）, `skill/`（名前と説明の検証・SKILL.md の読み取り・内蔵スキル・ライブラリ）, `profile`, `snapshot`, `backend`（BackendInfo・OptionSpec・PermissionRule・backendOptions の検証）, `activity`, `boot`, `storage`, `link`（外で開くリンクの検証: http・https だけ）, `error`（ドメインの検証エラー。どの入力かを `field` に持ち、CommandError.field になる）
- 権限の組み合わせ規則（design.md §5）の検証は `agent/validation.rs`（保存時に実効権限で判定）
- `conversation/`（`mentions` 解析、`routing` = design.md §7 を純粋関数で、`job` = JobSpec（agent・channel・mode・きっかけ集合・returnTo 集合・depth・rootId・注記）とレーンでの合流規則・ジョブが関わる会話の判定、`reply` = 返答の整形、`notices` = システム発言と注記の文面、`attachments` = プロンプトに渡す添付の選び方）
- `delegation/`（割り振り。design.md §7.1: `tasks` = tasks ブロックの読み取り、`state` = Delegation とサブタスクの状態、`verdict` = サブタスクの決着の判定）
- `autonomy`（判定と投稿先の選択）、`prompt/`（システムプロンプトと会話プロンプトの組み立て。現在日時の文字列・MEMORY.md・スキル一覧などは引数で受け取る）

### guild-application（依存: guild-domain, async-trait, tokio（sync・time・rt・macros）, parking_lot, log, thiserror, serde_json）
- `ports/`: 外界とのトレイト（`repositories`・`runtime`・`storage`・`system`・`attachments`・`library` に分けてある。下は主なものの抜粋で、正はそれぞれのファイル）
  ```rust
  AgentRepository / ChannelRepository / MessageRepository / SkillRepository / ProfileRepository / MetaRepository
  #[async_trait] AgentRuntime { status() -> RuntimeStatus; backends() -> Vec<BackendInfo>;
      async run(job_id, RuntimeRequest, ActivitySink) -> Result<String, RuntimeError>;   // RuntimeError::Cancelled を独立に持つ
      async cancel(job_id); async probe() -> Result<(), RuntimeError>; }
  EventPublisher { message_created / activity_changed / state_changed / skills_changed }
  Workspace { prepare(agent, backend) -> WorkspacePaths{work, state}; work_dir(agent); read_memory; remove; reveal }
  Folders { inspect(dir) -> 空・ギルドのフォルダ・その他; reveal(dir) }   // 保存先の検証とファイラ
  DataExporter { export_to(dir) }   SettingsStore { load / save }   Maintenance { enter / leave }
  StoragePorts（保存先変更に使うポートの束）   AppControl { request_restart }   // restart() は呼んだスレッドを止めるので使わない
  Clock { now_ms; local_label(ms) }   IdGenerator { new_id }   Spawner { spawn(future) }
  SkillLibraryScanner { scan(dir, limit); read_skill_file(folder); is_folder(path) }   // スキルライブラリ（design.md §14）。全体の上限はアプリ側が残り件数を渡して守る
  ```
- `error.rs`（AppError → CommandError の code と field に対応）、`services.rs`（AppServices）
- ユースケース: `agents`, `channels`, `skills/`（アプリ内のスキル・内蔵スキル・ライブラリ・参照しているスキルの読み直し）, `profile`, `snapshot`, `storage`, `autonomy`, `backends`（状態の確認し直しとログイン）, `maintenance`（保存先の変更中は送信と自発活動を止める）
- `conversation/`: `ConversationService`（入口）、`dispatcher`（**単一タスクのアクター**。レーン・割り振りの枠・エージェント排他・同時実行上限・世代・往復の上限のお知らせ・進行中の割り振りの記録を持ち、mpsc で Enqueue / Finished / Stop / RemoveAgent などを受ける。共有ロック不要。受け入れと合流は `intake`、選び方は `pick`（レーンの中は会話ごとに直列）、割り振りの記録は `tracking`、決着と打ち切りは `delegation`、停止と取り消しは `stopping`、毎回の処理のあとの見直しは `reconcile`、終了で消えるジョブの記録は `inflight`）、`executor`（1ジョブの実行: プロンプト組み立て → ランタイム → 保存 → イベント → 振り分け。依頼の組み立ては `request`、プロンプトに入れる発言の選び方は `history`、結果の確定は `commit` が結末（`ending`）と結果を返し、tasks ブロックからの割り振りの作成は `delegate`、作業の途中の投稿の保存は `interim`。実行中の知らせ（途中経過・途中の投稿）はアクターの `reporting` がコマンドにして受け取る）、`posting`（発言の保存と message-created の発行、参加とお知らせ）、`attachments`、`interrupted`（終了で中断された返答の知らせ）、`activity`
- テスト: ポートのフェイク（インメモリ）で、振り分けの一連の流れ・合流・排他・停止と世代・削除・タイムアウト・自発活動・保存先変更を検証する。時間は Clock のフェイクと tokio の時間停止で制御する。

### runner-client（公開 API の抜粋。正は `client.rs`）
中身は、`supervisor`（監視タスク: 起動して ready を待ち、落ちたらバックオフ付きで起動し直す）、`connection`（子プロセス1つ分）、`launch`（起動コマンドの組み立て）、`wire`・`protocol`（JSON の形）、`jobs`・`run`（実行中のジョブと結果の受け取り）、`job_object`（Windows で孤児プロセスを残さない）。
```rust
pub struct RunnerConfig { pub launch: Launch, pub args: Vec<String>, pub env: Vec<(String, String)>,
                          pub cwd: Option<PathBuf>, pub ready_timeout: Duration, pub cancel_grace: Duration }
pub enum RunnerStatus { Starting, Ready, Unavailable { message: String } }
impl RunnerClient {
    pub fn new(config: RunnerConfig) -> Self;                       // 失敗しない。tokio ランタイムの文脈で呼ぶ。監視タスクが起動・再起動
    pub fn status(&self) -> RunnerStatus;
    pub fn watch_status(&self) -> tokio::sync::watch::Receiver<RunnerStatus>;
    pub fn backends(&self) -> Vec<BackendInfo>;                     // ready でなければ空
    pub fn watch_backends(&self) -> tokio::sync::watch::Receiver<Vec<BackendInfo>>;
    pub async fn run(&self, job_id: &str, request: RunRequest, on_update: UpdateFn) -> Result<String, RunnerError>; // 途中経過と途中の投稿は RunUpdate で届く
    pub async fn cancel(&self, job_id: &str);
    pub async fn probe(&self) -> Result<(), RunnerError>; // 確認結果を待つ。30秒で応答待ち超過
    pub async fn login(&self, job_id: &str, backend: &str) -> Result<(), RunnerError>; // 窓が閉じるまで待つ。終わると backends が届く
    pub async fn shutdown(&self);
}
```

### 本体クレートの規則（arch-harness が syn で構文解析して検査）
- `interface` は `infrastructure`・`bootstrap` を参照しない。`infrastructure` は `interface`・`bootstrap` を参照しない。
- `#[tauri::command]` は `src/interface/commands/` だけ。`rusqlite` は `src/infrastructure/sqlite/` だけ。`runner_client` は `src/infrastructure/runtime/` だけ。
- guild-domain・guild-application の Cargo.toml の依存が上の許可リストに収まっていること。
- テンプレートの ID（`"worker"`・`"expert"` などの文字列）は guild-domain の `agent/templates.rs` の中だけ。権限は `permission_policy.rs` が先頭タグと役割表を照合して求め、その他の振る舞いはエージェントの設定で分岐する。
- **スレッドの規約**: コマンドはすべて async。タスクの生成は Spawner ポート（実装は `tauri::async_runtime`）経由。parking_lot のガードを await をまたいで持たない。
- 単体テストは長くなるなら別ファイル（`#[cfg(test)] mod tests;` で `tests.rs`）に置いてよい。どのファイルも行数規約の対象。

## agent-runner（agent-runner/src/）

```
agent-runner/src/
  main.ts              stdio の読み書きだけ（起動時に console.* を stderr に向ける。stdin の EOF で shutdown）
  line-parser.ts       JSON Lines の分割とパース
  request-decoder.ts   受信した JSON を RunnerRequest として検証する（未知のフィールドは捨てる）
  dispatcher.ts        要求の処理: run と login をジョブとして登録（終端イベントをちょうど1回保証）・cancel・probe・shutdown・未知 type
  dispatcher-errors.ts 失敗を error イベントの形にする（アダプタの BackendError はその code、ほかは internal）
  protocol.ts          契約（型と PROTOCOL_VERSION）
  log.ts               stderr 用のロガー（stdout はプロトコル専用）
  credentials/         バックエンドごとの API キーの保存と読み出し（Windows の資格情報マネージャー。docs/backend-api-keys.md）
  backends/
    types.ts           BackendAdapter インターフェース（info()・probe()・run(request, ctx)・任意の login(ctx)）
    registry.ts        アダプタの登録表
    claude.ts, claude/ Claude Agent SDK（権限 → tools、settingSources: []、スキルは stateDir のローカルプラグイン、readableDirs → additionalDirectories、
                       画像は1件だけ流すユーザーメッセージ、ログインは同梱の claude.exe の auth login を別ウィンドウで。操作の確認は claude/check.ts と judge.ts）
    codex.ts, codex/   Codex SDK（権限 → sandbox・ネットワーク・Web検索、人格とスキルの渡し方は SDK の都合に合わせて stateDir か毎回作り直し、
                       画像は local_image の入力）
    codex-runtime.ts, codex-runtime/  Codex 互換の CLI を動かす共通の実行部（イベント・実行ファイル・モデル・オプション）。codex・grok・muse が使う
    grok.ts, muse.ts   Grok（xAI）と Muse Spark。codex-runtime に、実行ごとの provider の設定を渡す（実験対応。docs/grok.md・docs/muse.md）
    describe.ts        ツール呼び出し → 「Web検索: …」などの表示文
    environment.ts, executables.ts  認証状態の確認に使う部品（資格情報は存在だけを見る）と、利用者の環境の CLI を探す部品
    agent-env.ts       エージェントに渡す環境変数（秘密らしい名前の変数はコマンドから除く）
    command-sandbox.ts, command-sandbox/  コマンドを OS の隔離の中で動かす共通の部品（Windows の MXC。docs/command-sandbox.md）
    tool-paths.ts      ファイル道具の入力からパスを取り出す部品と、パスや Glob の pattern の形だけで拒否する判定
                       （Windows のネットワークパス・代替データストリーム、起点の外を指す pattern）
    skill-files.ts     スキルを Agent Skills 標準のフォルダ（<name>/SKILL.md と付属ファイル）として書き出す
                       （リンク先からのコピーは skill-files/assets.ts、内蔵スキルの files は skill-files/bundled.ts）
```

## React（src/）: feature-based

```
src/
  main.tsx
  app/                       組み立て（AppShell、起動処理: 先に購読 → get_boot_status → 通常なら get_snapshot、復旧なら復旧画面）
  features/
    agents/ channels/ chat/ skills/ profile/ settings/ recovery/ runtime/
      index.ts               公開 API（他から使ってよいのはここだけ）
      api.ts                 この feature が使うコマンド（shared/api の型付きクライアント経由）
      store.ts               zustand のストア
      hooks/ components/ model/
  shared/
    api/                     client.ts（型付きクライアント）, contract.ts（コマンド・イベントの型表）, contractSchemas.ts（開発時に、戻り値とイベントが契約に合うかを確かめる）,
                             transport.ts, tauri.ts, mock/（ブラウザ用の偽バックエンド）, errors.ts（CommandError の判定）
    types/domain/            ドメイン型（契約。index.ts から import する）
    types/schemas/           契約の実例（contracts/ipc）が型に合うかを検査するスキーマ
    ui/                      汎用部品とテーマ（theme/ はデザイナー担当）
    lib/                     画面とモックの両方が使う純粋な関数（メンション・tasks ブロック・権限・上限など。Rust と同じ規則）
```

上の3つの構成図に書いたファイルとフォルダが実在することは、ハーネス（`scripts/harness/docsTree.test.mjs`）が検査する。構成を変えたら図も直す。

- バックエンド呼び出しは、コマンド名から引数・戻り値の型が決まる型付きクライアントで行う。失敗は `CommandError` として扱い、code で分岐する。validation のどの入力のことかは `field`（`shared/lib/errors` の `errorField`）で決める（メッセージの語から推し量らない）。
- 権限の表示・役割で決まる権限・その AI で使える操作と使わない理由（`shared/lib/permissions.ts`・`shared/lib/permissionPolicy.ts`）、外で開くリンクの判定（`shared/lib/links.ts`）、チャンネル名の正規化（`shared/lib/limits.ts`）は、編集画面とモックの両方が使うので shared/lib に置く（Rust の検証と同じ規則）。
- テーマ（ダーク / ライト / OS に合わせる）は settings feature が持つ。`main.tsx` が最初の描画の前に `initTheme()` を呼び、`<html data-theme>` を設定する。好みは localStorage（DB には入れない）。
- 画面の振る舞い（押す → 状態が変わる → 表示が変わる）は `src/app/App.*.test.tsx` で検査する。アプリ全体（`<App />`）を、ブラウザで動かすときと同じモックのバックエンドにつないで jsdom に描き、偽のタイマーで時間を進める（組み立ては `src/app/appFlow.test-support.tsx`）。jsdom を使うテストは先頭に `// @vitest-environment jsdom` を書き、ほかのテストは node のまま動かす。
- テストだけで使う部品（モックの組み立て・共通の値）は `<名前>.test-support.ts` に置く。vitest を import してよいのはテストとこれだけで、本番のコードからは import しない（ハーネスが検査）。
- エージェント作成のテンプレートと「バックエンド固有設定」は、それぞれ `Snapshot.templates` と `BackendInfo.options` から汎用的に描く（テンプレートやバックエンドを足しても React の変更は不要）。

## 契約の検査（contracts/）

- `contracts/ipc/*.json`: コマンドの戻り値・入力・イベント・エラーの実例。Rust（guild-domain のテスト）は「読み込んで書き戻すと一致する」ことを、TS（vitest）は `satisfies` で型に合うことを検査する。
- `contracts/runner/*.jsonl`: ランナープロトコルの要求・イベントの実例。runner-client と agent-runner の両方のテストが同じファイルを読む。
- `contracts/behavior/*.json`: Rust と TS の両方に実装がある規則（メンション解析・tasks ブロックの読み取り・お知らせの文面）の実例。入力と期待する結果を並べ、Rust（guild-domain の `tests/domain/behavior.rs`）と TS（`*.behavior.test.ts`・`mock/notices.test.ts`）が同じファイルで同じ結果になることを検査する。正は Rust で、画面の `shared/lib` とブラウザ用のモックがずれたらテストが落ちる。

## 拡張のしかた（足すだけで済むこと）

- **新しいバックエンド**（例: Gemini CLI）: `agent-runner/src/backends/<id>.ts` に BackendAdapter を実装して `registry.ts` に1行。Codex 互換の CLI なら、Grok・Muse のように共通の `codex-runtime.ts` に provider の設定を渡すだけで済む。アダプタ同士は import できないので、共通部品を足したらハーネスの設定（`scripts/harness/lib/config.mjs` の `RUNNER_BACKEND_COMMON_MODULES`）にも足す。能力・状態・設定項目はアダプタが申告するので、Rust・React の変更は不要。
- **新しいテンプレート**（例: マネージャー）: guild-domain の `agent/templates.rs` に1行。React は `Snapshot.templates` から自動で選択肢を出す。ランナーは変更不要。新しい振る舞いそのもの（今ある設定で表せないもの）が要るときだけ、Agent に設定項目を1つ足し、それを見るのは routing / prompt の該当箇所だけにする。
- **新しいコマンド**: guild-application にユースケース → interface/commands にハンドラ → lib.rs に登録 → contract.ts と design.md の表 → フィクスチャ → feature の api.ts。
- **新しいイベント**: EventPublisher → infrastructure/events.rs → contract.ts と design.md → フィクスチャ。
