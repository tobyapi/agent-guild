# AIギルド

人間と AI エージェント（作業者・発想役・専門家・マネージャー）がチャンネルで会話する Tauri + React デスクトップアプリ。
- 仕様・IPC 契約・実行モデル・振り分け規則・データフォルダ・互換性方針: `docs/design.md`
- コード構造と拡張のしかた: `docs/architecture.md`
- 型の正: `src/shared/types/domain/`（React ⇄ Rust。import は `@/shared/types/domain` から）、`agent-runner/src/protocol.ts`（Rust ⇄ ランナー）。実例: `contracts/`
- 見た目の指針: `docs/ui-design.md`、トークン: `src/shared/ui/theme/`

## コマンド

- `npm run app` … Tauri アプリを開発モードで起動
- `npm run dev` … フロントだけ起動（ブラウザではモックのバックエンドで動く）
- `npm run bundle` … 配布用のアプリとインストーラーを作る（agent-runner と Node.js を同梱。Claude Code・Codex CLI は利用者の環境のものを使う）。CI は `.github/workflows/build.yml`
- `npm run format` … コードを整形する（TS・CSS は Prettier、Rust は cargo fmt。どちらも幅120）
- `npm run check` … 整形の確認・型チェック・lint・ハーネス・テスト・clippy・Rust テストを全部実行。全体検証用。ローカルで毎回実行する必要はない。CI（`.github/workflows/check.yml`）では、main への push とプルリクエストで実行する

## ローカルでの検証

- **変更に関係するチェックだけを選ぶ。毎回の全テスト実行を既定にしない。** 実装中は対象を絞り、通過後は新しい変更・失敗・未解決の懸念がある場合だけ再実行する。commit・push・pull 自体を理由に全チェックを繰り返さない。
- 文書・コメントだけの変更は差分の確認でよい。単純な文言・見た目の変更は該当箇所の確認を中心にし、動作に影響するときだけ関連テストを選ぶ。
- TS / React / ランナー: `npx vitest run <関連するテストファイル>` を使う。型を変えた場合は対応する tsconfig の型チェック、コードを変えた場合は変更ファイルの ESLint・Prettier を必要に応じて実行する。
- Rust: `cargo test --manifest-path src-tauri/Cargo.toml -p <クレート> <テスト名のフィルター>` などで影響する範囲を検証する。整形と clippy も変更したクレートを中心に確認する。
- IPC・共通ルールを変えた場合は Rust と TS の両側の契約テストを選ぶ。依存の向きやファイル構成を変えた場合は対応する保守性ハーネスを実行する。
- 全体に及ぶ変更、依存関係・ビルド設定の変更、影響範囲を絞れない不具合、利用者から全検証を依頼された場合は `npm run check` を実行する。通常の変更の全体検証は CI に任せる。
- 完了報告では、実行した検証と、検証できていない重要な点を簡潔に伝える。

## 開発方針

- 拡張性と互換性の保ちやすさが最優先。**後方互換を保つ**: 配布済みのアプリが保存したデータ（データフォルダ・SQLite・settings.json）とスキル形式を、新しい版で開けなくしない。
  - DB のスキーマは、マイグレーションを追記して変える。`migrations/` の既存のファイルは書き換えない（0001 は凍結済み。指紋を固定するテストがある）。
  - 保存する値の形（JSON の列・settings.json・guild-data.json）を変えるときは、古い形も読めるようにするか、マイグレーションで直す。
  - 互換のために残すコードには、何のためのものかと、消せる条件をコメントに書く。
- 互換性の境界（データフォルダ・スキル形式）は版管理の仕組みで守る。IPC とランナープロトコルは、同じアプリに同梱して同時に出荷する内部契約なので、互換を保たずに変えてよい。ただし文書とフィクスチャを常に正しく保つ。
- バックエンドごとの違いは、アダプタの申告（`BackendInfo`。能力・設定項目・指定フォルダの守り方・セットアップなど）で表す。Rust と React では、バックエンドの ID で分岐しない（新しいバックエンドは、agent-runner にアダプタを足すだけで済ませる）。
- 契約（domain.ts・protocol.ts・design.md の表）を変えたら、`contracts/` のフィクスチャと両側の型を同じ変更で直す。
- Rust と TS の両方に実装がある規則（メンション解析・tasks ブロックの読み取り・お知らせの文面）は Rust が正。変えたら、`contracts/behavior/` の実例と、TS 側（`src/shared/lib/`・モック）を同じ変更で直す。

## 保守性ハーネス（`npm run check` で自動検査）

### 共通
- **コードは整形済みであること**（`npm run format`。設定は `.prettierrc.json` と `src-tauri/rustfmt.toml`）。行を手で詰めて行数を減らさない。
- **1ファイルの空行を除いた行数は200行未満**（.ts / .tsx / .css / .mjs / .rs）。超えそうなら責務で分割する。対象は src/・agent-runner/src/・scripts/・src-tauri/src/・src-tauri/crates/*/（src・tests）。node_modules・target・dist は対象外。
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
- 権限と基本の役割の指示は先頭タグに対応する役割の表から決める（`agent/permission_policy.rs`）。バックエンドの制約は許可を広げず解決する。会話の振り分けは本人の設定（unmentioned・consultable・canDelegate・autonomyEnabled）で決める。タグの文字列やテンプレート ID をハードコードして分岐しない（ID は `agent/templates.rs` の表だけ。arch-harness が検査）。バックエンドの ID でも分岐しない（`BackendInfo` の申告を見る）。
- コマンドはすべて async。タスクの生成は Spawner ポート経由。parking_lot のガードを await をまたいで持たない。
- 本番コードで `unwrap()` / `expect()` を使わない（テストは可）。
- clippy: 関数60行まで、認知的複雑度15まで（src-tauri/clippy.toml）。`cargo clippy --workspace --all-targets -- -D warnings` が通ること。
- 純粋なロジック（メンション解析・振り分け・合流・自発活動の判定・プロンプト組み立て・検証）と、ユースケース（フェイクのポートで）に単体テストを書く。
