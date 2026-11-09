# AIギルド

人間と AI エージェント（作業者・専門家）がチャンネルで会話する Tauri + React デスクトップアプリ。
- 仕様・IPC 契約・実行モデル・振り分け規則・データフォルダ・互換性方針: `docs/design.md`
- コード構造と拡張のしかた: `docs/architecture.md`
- 型の正: `src/shared/types/domain/`（React ⇄ Rust。import は `@/shared/types/domain` から）、`agent-runner/src/protocol.ts`（Rust ⇄ ランナー）。実例: `contracts/`
- 見た目の指針: `docs/ui-design.md`、トークン: `src/shared/ui/theme/`

## コマンド

- `npm run app` … Tauri アプリを開発モードで起動
- `npm run dev` … フロントだけ起動（ブラウザではモックのバックエンドで動く）
- `npm run bundle` … 配布用のアプリとインストーラーを作る（agent-runner を同梱。Claude Code・Codex CLI・Node.js は利用者の環境のものを使う）。CI は `.github/workflows/build.yml`
- `npm run check` … 型チェック・lint・ハーネス・テスト・clippy・Rust テストを全部実行。**作業の最後に必ず通す**。CI（`.github/workflows/check.yml`）でも、main への push とプルリクエストで同じものが走る

## 開発方針

- 拡張性と互換性の保ちやすさが最優先。ただし**リリース前の今は後方互換のコードを書かない**。より良い形があれば壊して作り直す（DB マイグレーションも 0001 を直接書き換える）。
- 互換性の境界（データフォルダ・スキル形式）には版管理の仕組みを最初から持たせる。IPC とランナープロトコルは同梱の内部契約で、文書とフィクスチャを常に正しく保つ。
- 契約（domain.ts・protocol.ts・design.md の表）を変えたら、`contracts/` のフィクスチャと両側の型を同じ変更で直す。

## 保守性ハーネス（`npm run check` で自動検査）

### 共通
- **1ファイルの空行を除いた行数は150行未満**（.ts / .tsx / .css / .mjs / .rs）。超えそうなら責務で分割する。対象は src/・agent-runner/src/・scripts/・src-tauri/src/・src-tauri/crates/*/（src・tests）。.old/・node_modules・target・dist は対象外。
- 1ファイル・1モジュールは1つの責務。名前を見れば中身が分かるようにする。

### React（`src/`）: feature-based
- `shared/` は `features/` と `app/` を import しない。`features/` は `app/` を import しない。
- 別の feature は **その index.ts 経由でだけ** import する（`@/features/agents` は可、`@/features/agents/store` や `../../agents/store` は不可）。`export *` と動的 import も同じ規則で検査する。各 feature は index.ts を持つ。
- `@tauri-apps/*` を import してよいのは `src/shared/api/` だけ。
- `@/shared/api` を import してよいのは各 feature の `api.ts` と `app/` だけ（コンポーネントから直接バックエンドを呼ばない）。
- `vitest` を import してよいのはテスト（`*.test.ts`）とテスト用の部品（`*.test-support.ts`）だけ。テスト用の部品は本番のコードから import しない（src/・agent-runner/src/ の両方）。
- 色・余白・文字サイズ・角丸・影・動きは `src/shared/ui/theme/tokens.css` の変数で指定する。
- ESLint: react-hooks のルール、関数は80行まで、循環的複雑度12まで。

### agent-runner（`agent-runner/src/`）
- `backends/<adapter>.ts` は他のアダプタを import しない（共通部品は `backends/types.ts` などへ）。
- `process.stdin` / `process.stdout` に触れてよいのは `main.ts` だけ。`console.log` などは使わず、ログは stderr 用のロガーで出す。

### Rust（`src-tauri/`）: クレートで分けたポートとアダプタ
- 依存の向き `guild-domain` ← `guild-application` ← 本体（infrastructure / interface / bootstrap）は**クレートの依存で強制**する。guild-domain と guild-application の依存は architecture.md の許可リストの範囲だけ（arch-harness が Cargo.toml を検査）。
- 本体の中: `interface` は `infrastructure`・`bootstrap` を参照しない。`infrastructure` は `interface`・`bootstrap` を参照しない。組み立ては `bootstrap/`・`lib.rs`・`main.rs` だけ。
- `#[tauri::command]` は `src/interface/commands/` だけ。`rusqlite` は `src/infrastructure/sqlite/` だけ。`runner_client` は `src/infrastructure/runtime/` だけ。
- エージェントに「種別」はない。振る舞いは本人の設定（permissions・unmentioned・consultable・autonomyEnabled）で決め、タグの文字列やテンプレート ID で分岐しない（テンプレートの ID は guild-domain の `agent/templates.rs` の中だけで使う。arch-harness が検査）。
- コマンドはすべて async。タスクの生成は Spawner ポート経由。parking_lot のガードを await をまたいで持たない。
- 本番コードで `unwrap()` / `expect()` を使わない（テストは可）。
- clippy: 関数60行まで、認知的複雑度15まで（src-tauri/clippy.toml）。`cargo clippy --workspace --all-targets -- -D warnings` が通ること。
- 純粋なロジック（メンション解析・振り分け・合流・自発活動の判定・プロンプト組み立て・検証）と、ユースケース（フェイクのポートで）に単体テストを書く。
