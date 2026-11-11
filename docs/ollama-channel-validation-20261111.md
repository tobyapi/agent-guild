# Ollama権限・チャンネル作業フォルダの統合検証（2026-11-11）

## 対象

基点は `1e3f72888d42c64d753fcd8772943aa98398b83f`。Claudeの `work/implementation` から機能に関する67ファイルを自分の `work/implementation-ollama-channel` へコピーし、その後の修正を加えた。引継ぎ元の画像・アイコンは対象外とし、引継ぎ元を変更・削除していない。初期コピーの一覧とSHA-256は作業コピーの隣の `ollama-channel-validation/handoff-files.json`。

`ollama-tools-validation.md` は統合前の試作の記録。本書が今回の結果を記録する。実DB、既存アカウント設定、稼働アプリは操作していない。モデルのダウンロードはしていない。

## 実装した動作

- Ollamaのバックエンド詳細の `enableTools` は既定false。選択モデルのtools能力と明示的な保存値trueがそろって初めて、役割の権限を与える。React、Rustの保存時・実行時、runnerで検証する。未設定の既存エージェントは会話専用のまま。`/api/show` の能力を実行前にも確認する。
- Web検索・取得、スキルは能力false。Ollamaのファイル操作とコマンドはmacOSのSeatbeltが必要。通常モードのコマンドはforkを禁止した単一プロセスに限る。Seatbeltが利用できなければ通常実行へ切り替えない。
- チャンネル設定に「今までどおり」「指定した作業フォルダ」「PC全体（役割の権限）」を追加。PC全体も役割とバックエンドの能力が上限で、自動で権限を増やさない。フォルダは存在する絶対パスを正規化し、アプリ保存領域とその祖先・子孫を拒否する。
- 新しい `0005_channel_workspace.sql` は `channels.workspace_json` を追加する。既存チャンネルはlegacy/revision=0になり、名前・話題・ロビー属性を保つ。名前・話題更新とは別のSQLで作業範囲を保存し、古い画面情報で範囲設定を戻さない。
- 指定フォルダではmacOSのOllamaのファイル操作を提供する。読み書きは指定先とチャンネル専用work、読み取りのみ相談相手の成果物と当該チャンネルの添付を許す。相談相手の `MEMORY.md`、範囲外の実体、ハードリンク、特殊ファイルを拒否する。コマンド、スキル、readAnywhere、writeAnywhereを無効化する。
- 指定フォルダでClaudeは実行前に停止する。継承したcanUseTool/PreToolUse点検だけでは、点検後に親ディレクトリやファイルがリンクへ差し替わる競合を防げないため。Codex・Grok・Muse等も未対応としてRust・runnerの入口で停止する。Claudeの通常モードは既存動作を維持する。
- Ollamaの指定フォルダ操作は固定NodeコードをSeatbelt内で実行し、モデル入力はJSONとして渡す。O_NOFOLLOWで開き、実体、inode/dev、通常ファイル、リンク数1を確認してから読み取り・切り詰めを行う。本文だけをモデルへ返し、`exit=0`をファイル内容へ混入させない。既存親ディレクトリとUTF-8ファイル、32KiBまでに限る。
- 範囲変更時はrevisionを増やし、channel/agent/revision別のwork・state・MEMORYを使う。過去のメッセージはDBと画面に残し、切替時のseq以前を新しいモデル履歴へ渡さない。元の範囲へ戻しても新revisionを使う。同じ範囲の再保存ではrevisionを増やさない。実行中・待機中・割り振り中のチャンネルでは変更を拒否する。

## 今回の確認

検証ログは作業コピーの隣の `ollama-channel-validation/` に置く。重い検証は逐次実行した。RustのDBテストはin-memory SQLiteまたは一時領域だけを使う。

|確認|結果・根拠|
|---|---|
|全体チェック|`npm run check`。format、アプリ/runner型検査、ESLint、保守性ハーネス、Vitest、Rust clippy（warnings拒否）、Rust workspaceテスト。終了コード0、Vitest 113ファイル730件、Rust workspace 334件成功。最終結果は `check-final-complete.log` と終了コードの `check-final-complete.json`|
|画面の保存・再表示|`App.channels.test.tsx`。未指定パスで保存拒否、指定フォルダ保存、再表示、今までどおりへ変更後の再表示。jsdomとIPCモックで確認。実Tauri画面のクリック確認ではない|
|既存DBとの互換性|migration 0001〜0004のメモリDBに既存チャンネルを作成し0005適用。値維持、legacy初期値、移行再実行を確認。通常のDatabase::openでも固定した0004指紋の合成DBを開き、0005への更新・内容維持・退避なしを確認。実DBのコピーは使わない|
|範囲の分離|Rustアプリテストで旧履歴・旧MEMORYの除外、work/stateの変更、同範囲保存と復帰時の新revision、実行中の変更拒否を確認。FsWorkspaceの実一時フォルダでもagent/channel/revision別メモとstateを確認|
|ファイルの境界|folder-scopeとOllama toolsテスト。範囲外、外向きsymlink、hardlink、相談メモ、Globの絶対・親参照パターンを拒否。実Seatbeltで読み書き、一覧、成果物読み取り、コマンド拒否を確認|
|実モデル|既存ローカル `gemma4:26b` を本番ollamaAdapterから呼び、合成input.txtのread_file→指定フォルダoutput.txtへのwrite_file→最終DONEを確認。出力の内容は `LOCAL_FIXTURE_7C92` と一致。`local-model.log`、再現スクリプト `local-model.mjs`|
|他モデル|`deepseek-r1:8b` は今回の指示で道具を使わず往復を完了しなかった。成功扱いにしない。`local-model-deepseek.log`|
|単一プロセスの制約|実Seatbeltで `/bin/echo ready` 成功、パイプライン拒否、時間超過・中断を確認。git/npm/一般のビルドが使えるとは主張しない|

最初の実モデル試行ではread_fileの返却に付いていた `exit=0` を内容としてコピーした。本文だけを返す修正後のログが `local-model.log`。`local-model-gemma-first.log` は修正前として保持する。初期チェックの型・lint・clippy失敗ログも消さず、最終ログと区別する。

## 参照と残る制約

参照した上流は [openai/codex](https://github.com/openai/codex/tree/5228d94a27b7f84cae4854acbb5ea3b3e90dfeaf)。ローカル参照のHEADも同SHAであることを再確認した。固定sandbox-exec、既定拒否、ツールルーターの構成を参照し、コード・ポリシーは転載していない。上流はforkを許すが、本実装は停止保証の範囲を単一プロセスに狭めるため許さない。

- macOS以外での道具実行、OllamaのWeb/スキル、指定フォルダでのClaude/Codex/Grok/Muse・コマンドは未対応として停止する。すべてのバックエンドが指定フォルダで使える完成状態ではない。
- Ollamaの有効化設定はin-memory SQLiteへの保存・読み戻し（未設定→false→true→false）で維持を確認した。設定から実モデルまでを実Tauri UIで通す試験は未実施。
- 32KiBの全体書き込み方式で、差分編集・フォルダ作成・バイナリ編集は提供しない。相談先の作業フォルダがまだ存在しなければ読み取り準備に失敗し、その依頼を停止する。
- 同じ指定フォルダを複数チャンネルで共有できる。成果物のファイルは共有され、共有ファイルに人が過去の会話をコピーすれば新しいモデルも読める。履歴・メモの分離はアプリによる自動投入と内部保存領域の分離であり、同じ成果物の内容分離ではない。
- フォルダ内の秘密ファイルは利用者が指定した範囲として扱う。Web権限を持つ別バックエンド・通常モードのPC全体権限など、既存の広い権限の仕様はこの変更で縮小していない。
- OS実行に必要なライブラリ等とファイルメタデータの参照はSeatbeltで許可する。管理者権限の攻撃者、同時にファイルを書き換える外部プロセス、別マウントなどを含む完全な攻撃耐性は未認定。独立した安全レビューは未実施。
- 検証用adapterの実モデル往復は成功したが、インストール済みアプリの再ビルド・起動・実Tauri画面からの往復・配布物検証は実施していない。実DB、稼働アプリ、ユーザー設定には変更を加えていない。pushはしない。
