# Ollama作業者・チャンネル機能の統合検証（2026-11-11）

## 統合した変更

共通の基点は `1e3f72888d42c64d753fcd8772943aa98398b83f`。ローカルの `faed24de96e01f8db1b3a1897f389bd552ced477`（JSON操作・スキル・途中投稿）と、リモートの `39c59c646b9ac3e0ea715c6c438493527622c172`（明示的な道具有効化・ネイティブtools・チャンネル作業範囲）を統合した。

リモートの作者・コミッターを依頼に従って `tobyapi <landofscala@gmail.com>` に修正し、`17d01be384efc123f3fe09aa953797f173680e4b` を作成した。修正前後のコミットのtree・親・メッセージ・日時は保持し、統合コミットも同じ名義にする。ローカルの `faed24d` は元からこの名義のため保持する。名義修正とpushの新旧SHA・lease・結果は作業場所の `merge-final-report.json` に記録する。

リモート変更88ファイルを照合し、71ファイルは内容をそのまま保持、残り17ファイルはOllamaの統合・契約・説明に合わせて更新した。欠落したファイルはない。チャンネルのmigration 0005、専用作業場所、履歴境界、相談相手のメモ保護を保持した。

## 統合後の動作

- 道具は `enableTools: true` を保存した場合のみ有効。設定なしの既存エージェントは会話専用。
- `auto` は対応モデルでネイティブtoolsを使い、それ以外ではJSON操作を使う。`toolProtocol: json` はJSON操作を明示する。
- 両経路が同じSeatbelt・ファイル実行・権限検査を使う。JSON経路からCodex CLIへの依存を除いた。
- 操作確認は既定オン。コマンドとwriteAnywhere時の書き込みは、依頼への適合を別のモデル呼び出しで確認する。
- 指定フォルダではコマンド・スキル・PC全体の権限を拒否し、相談相手のMEMORY.mdを保護する。
- 通常のファイル操作でも、特殊ファイル・複数リンクを持つファイル・確認した実体と異なるファイルを拒否する。MEMORY.md例外は別ファイルへのリンクに適用しない。
- コマンドは単一プロセスに限り、ネットワークを許可しない。隔離に失敗した場合の通常シェルへの切り替えはない。

## 自動検証

最終コードで以下が成功した。実行ログは担当作業場所に保存した。

| 検証 | 結果 | ログ |
| --- | --- | --- |
| Vitest全体 | 118ファイル・757件成功 | `merge-tests.log` |
| React・runnerの型チェック | 成功 | `merge-typecheck.log` |
| ESLint | 成功 | `merge-lint.log` |
| Prettier・cargo fmt | 成功 | `merge-format.log` |
| 保守性ハーネス | 32件成功・TS違反なし | `merge-harness.log` |
| Rust workspace | 334件成功 | `merge-rust-tests.log` |
| Clippy全ターゲット | 警告をエラーとして成功 | `merge-clippy.log` |

追加した統合試験は、opt-in前の不実行、操作確認による拒否、JSON経路の指定フォルダ境界とMEMORY保護、コマンド・スキル併用の拒否、MEMORYリンク拒否、ネイティブ経路のスキルと投稿、スキル付属ファイルの展開と後片付け、JSON形式の明示指定による実ファイル保存を検査する。ネイティブ経路のHTTP応答はモックである。

## 実macOS・実Ollamaの検証

実Seatbeltでは、作業場所内の書き込み成功、範囲外・リンク先・書き込み権限なしの拒否、ハードリンク拒否、コマンド中断、writeAnywhereを持つ作業者の許可範囲外書き込み成功を確認した。管理領域への制約とネットワーク拒否は自動試験でも検査する。ログは `merge-security-final.log`。

実 `deepseek-r1:8b` にJSON形式を指定し、スキル本文の参照、ファイル作成と読み返し、途中投稿を実行イベントとディスク内容で確認した（`merge-live-verification.jsonl`）。同ログの通常の `cat` コマンドはfork禁止により失敗したため、総合試験全体はPASSとして扱わない。

別試験の `exec /bin/cat result.txt > command-result.txt` は成功し、出力ファイルの内容を照合した（`merge-live-command.jsonl`）。既存ファイルの `OLD` から `NEW-7319` への上書きも確認した（`merge-live-edit.jsonl`）。これらは `operationCheck: false` で実行し、操作確認の拒否は自動試験で検査した。

最終コードの実Ollama要求をDispatcherから中断し、cancelledイベント・結果投稿なし・後続ファイル作成なしを確認した（`merge-live-cancel-final.log`）。

最終コードで既存ファイル上書きを再試験した際、保存内容が空文字になり照合に失敗した（`merge-live-edit-final.log`）。依頼を相対パスと明示した本文で短くして再実行した試験では、`OLD` から `NEW-7319` への上書きと最終回答を確認した（`merge-live-edit-retry.log`）。成功・失敗の両方を記録し、モデルによる本文の指定が安定しているとは判断しない。

## 残る制約

実DeepSeekはtools対応を申告しても操作を呼ばずに文章だけを返す場合があった（`merge-live-native-attempt.jsonl`）。JSON形式の実行成功も、自由な依頼を安定して完了する保証ではない。モデルはパス・本文の誤り、反復、空回答を返すことがある。

Web、readAnywhere、fork・パイプ・ビルドなどの子プロセス生成、差分編集、永続セッションは未対応。Windows/Linuxの道具実行と配布アプリ画面の操作は未検証。操作確認のモデル判断だけで認可を保証せず、権限検査とOSの制限を併用する。
