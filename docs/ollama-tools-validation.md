> この文書は統合前の試作の検証記録です。今回の成果物・実モデルの結果は [チャンネル統合検証](ollama-channel-validation-20261111.md) を参照してください。

# Ollama 道具実行・仕上げ検証（2026-11-11）

## 報告の基準

今回は既存差分の仕上げのみ。実モデルの呼び出し・モデルダウンロード・コミットは実施しない。以前の608件成功等は会話内の途中報告であり、実行ログがなければ終了コードの再確認とは区別する。

## 到達度

1. 権限受け渡し: 実装・自動テストあり。既存の役割を基礎に、画面・Rust保存/実行時・runnerで制限。
2. 実行ループ: 実装・HTTP/OSモックのテストあり。16ターン/64道具/5分の上限。
3. 読み書き: 実装・実Seatbeltテストあり。realpath、許可範囲、管理領域保護、32KiB制限。
4. コマンド: 一部。macOS Seatbelt・単一プロセスのみ。fork禁止のため一般的なビルド環境と同等ではない。
5. Web: 未実装。専用取得/検索の能力はfalse。
6. スキル: 未実装。能力はfalse。

## 保存互換性

設定名は `enableTools`（UI: 道具の利用を有効にする）、既定値false。既存SQLite agents.backend_options TEXTのJSONに保存。既存値にtrueがない限り道具を渡さない。/api/showのtools能力も必要。migration追加なし。operationCheckは既定trueの補助確認。

## 今回の検証

静的チェックと必要な再テストは順に実行し、この節へ結果を追記する。以前の報告: Ollama20件成功、Vitest104ファイル608件成功、cargo test全体成功（過去の終了コードはログ未確認）。実Seatbeltの検証内容は tools.test.ts を参照。

## 元ツリー・ユーザーデータ

開始時の元ツリーはロビー関連の22パス（開始時スナップショット参照）。この作業では元ツリー・DB・設定を変更する操作をしない。以前の作業開始前スナップショットがないため、11:59以降の無変更を遡及証明することはできない。この回の前後比較を記録する。共有アプリ自身のDB更新と他の担当者の変更は区別が必要。

## 普段使いまでの残作業

独立した安全レビュー、実モデルでの確認（今回は実施しない）、競合/リンク/パス差し替え攻撃の追加検証、対応OSの整備、Web/スキルの実装、既存ロビー・専門家読み取り権限差分との統合検証が必要。子孫プロセス対応はプロセスグループ単位の終了だけでなく、setsid/setpgidで離脱する子孫への対応が必要。設計・実装・回避テストを含め2〜4人日程度を仮見積もりとする（OS方式の調査次第で増える）。

## 今回の結果

|コマンド|終了コード/結果|
|---|---|
|`npm run typecheck`|0、アプリとrunnerのtsc成功|
|`npm run lint`|0、ESLint指摘0件|
|`cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` PATH設定前|127、cargoがPATHにない|
|同上、PATHへ ~/.cargo/bin を追加して再実行|0、改行形式修正後も0|
|`npm test -- --maxWorkers=2`|0、104ファイル608件成功。実Seatbeltテストを含む|
|`cargo test --manifest-path src-tauri/Cargo.toml --workspace -j 2`|0、workspace全体成功、失敗0件、doc-testsも成功|
|`git -c core.whitespace=cr-at-eol diff --check`|0|

Nodeは /tmp/agent-guild-tools/node-v24.22.1-darwin-arm64/bin をPATH先頭へ追加。重い処理の前にpsを確認し、重複なし。検証は逐次実行。通常のgit diff --checkは既存CRLF文書の変更2行を末尾空白として報告するため、改行を保ちcr-at-eolを指定した。

Rust2ファイルの改行だけの差分を元のCRLFに戻し、実変更だけになるよう整理した。テスト弱体化やlint無効化コメントの追加はない。

### データ確認

この回の開始/終了比較では、元ツリーのstatus、追跡済み全diffのSHA-256、未追跡3ファイルのSHA-256はすべて一致。22パスはロビー関連で追加の変更なし。

data/guild.dbとguild.db-shmはサイズ・更新時刻とも一致。guild.db-walはサイズ同一だが更新時刻が変わった。アプリ稼働中で、更新主体は特定していない。この作業のコマンドからDB・設定を変更していないが、ユーザーデータ全体の「変化なし」は確認できない。以前の作業開始前の比較資料もない。

### 追加したテスト

- agent-runner/src/backends/ollama/tool-loop.test.ts（10件）: 既存設定/非対応モデル/未許可要求拒否、ツール往復、16ターン/64件上限、中断、操作確認拒否、show能力の再確認。
- agent-runner/src/backends/ollama/tools.test.ts（7件、うち5件はmacOS実Seatbelt）: 道具一覧、既定拒否、実読み書き/../・symlink・外部書き込み・network拒否、未知ツール/出力上限/中断、state祖先rename/hardlink拒否、追加フォルダからのhardlink拒否、単一コマンド成功/パイプライン拒否/30秒制限。
- src/features/agents/model/validation.test.ts: 明示有効化と対応モデル検証。
- src/shared/lib/permissionPolicy.test.ts: 既定無効/有効/不明モデルの権限計算。
- src-tauri/crates/guild-domain/tests/domain/permission_policy.rs: ollama_requires_explicit_opt_in_and_a_tool_capable_model。
- src-tauri/crates/guild-domain/tests/domain/backend_options.rs: 既存fixtureへのtools未指定追加（新規テストなし）。

### git diff --stat

追跡済みファイルのみ。新規6ファイルは別記。

```text
 agent-runner/src/backends/ollama.ts                | 61 +++++++++++++---------
 agent-runner/src/backends/ollama/api.ts            |  9 +++-
 agent-runner/src/backends/ollama/http.ts           | 10 +++-
 agent-runner/src/protocol.ts                       |  2 +
 docs/design.md                                     |  4 +-
 .../crates/guild-domain/src/agent/permissions.rs   | 13 +++++
 .../crates/guild-domain/src/agent/validation.rs    | 11 ++++
 src-tauri/crates/guild-domain/src/backend/mod.rs   |  2 +
 .../guild-domain/tests/domain/backend_options.rs   |  1 +
 .../guild-domain/tests/domain/permission_policy.rs | 39 ++++++++++++++
 src-tauri/crates/runner-client/src/protocol.rs     |  2 +
 src-tauri/src/infrastructure/runtime/convert.rs    |  1 +
 src/features/agents/hooks/useAgentDraft.ts         | 10 +++-
 src/features/agents/model/validation.test.ts       | 26 +++++++++
 src/features/agents/model/validation.ts            | 17 +++++-
 src/shared/api/mock/handlers/agentInput.ts         | 15 +++++-
 src/shared/api/mock/handlers/system.ts             |  7 ++-
 src/shared/lib/permissionPolicy.test.ts            | 19 +++++++
 src/shared/lib/permissionPolicy.ts                 | 18 +++++++
 src/shared/types/domain/backend.ts                 |  2 +
 src/shared/types/schemas/system.ts                 |  1 +
 21 files changed, 232 insertions(+), 38 deletions(-)
```

新規ファイル:

```text
agent-runner/src/backends/ollama/chat.ts
agent-runner/src/backends/ollama/tool-loop.test.ts
agent-runner/src/backends/ollama/tools.test.ts
agent-runner/src/backends/ollama/tools.ts
docs/ollama-tools-validation.md
docs/ollama-tools.md
```
