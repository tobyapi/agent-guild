# Ollama の道具実行（試作）

## 方針

Ollama `/api/chat` に権限から作った関数定義を渡し、assistant の `tool_calls` を逐次実行して、`role: tool` / `tool_name` の結果を返す。最終回答まで最大16ターン、道具は合計64件。1実行5分、各子プロセス30秒、道具の出力と書き込みは32KiB、HTTP応答2MiB、会話履歴4MiBを上限とする。中断時・時間切れ・出力超過時は直接PIDとプロセスグループを終了する。forkはOS側で禁止する。

権限は役割から求める既存方式を維持する。Ollama には `enableTools: true` の明示的な保存と、選択モデルの `tools: true` の両方を要求する。対応能力は `/api/show` で確認する。既存エージェントは保存済みの権限値や役割が広くても、更新だけでは道具を使用できない。新しいDB migration は不要。画面のバックエンド詳細設定から有効化する。非対応モデルで有効化して保存すると検証エラーになる。

## 参照した実装

- https://github.com/openai/codex （参照コミット `5228d94a27b7f84cae4854acbb5ea3b3e90dfeaf`、Apache-2.0）
- `codex-rs/core/src/tools/router.rs`: 定義されたツールへの振り分け、未知の要求の拒否。
- `codex-rs/sandboxing/src/seatbelt.rs`, `seatbelt_base_policy.sbpl`, `seatbelt_read_only_platform_defaults.sbpl`: 固定の `/usr/bin/sandbox-exec`、既定拒否、ファイルとネットワークの制限、子プロセスへの制限継承の設計（今回は生成自体を禁止）。
- `codex-rs/ollama/src/client.rs`: ローカルモデル接続の構成を確認。
- https://docs.ollama.com/capabilities/tool-calling : `tools` / `tool_calls` と結果メッセージの形式。

ソース・Seatbeltポリシーの転載はせず、必要な処理を独自実装した。参照リポジトリは `/tmp/agent-guild-codex-reference-20261111` に浅くcloneして閲覧のみ実施。ビルド・実行していない。`apply_patch` は導入せず、サイズ制限付きUTF-8全体書き込みを使う。

## 権限ごとの対策

|権限|実装|
|---|---|
|読み取り|`read_file` / `list_files`。realpathで作業場所・readableDirsを照合。`writeAnywhere` があれば範囲を広げる。実操作もSeatbelt内のcat / lsで行う。|
|書き込み|`write_file`。親が存在するファイルをteeで書く。realpath照合とOS制限の両方を適用。新しい親ディレクトリはコマンド権限で作成する。|
|PC全体|`writeFiles` が必要。管理用stateDirへの書き込みと祖先の移動は常に拒否する。|
|コマンド|`run_command`。readFilesが必要。macOS以外では能力を申告せず、実行時も拒否。通常シェルへのフォールバックなし。停止を保証するためforkを禁止し、単一プロセスで実行する。パイプライン、複数の外部コマンド、子プロセスを使うビルド等は非対応。親の環境変数は引き継がない。|
|Web|専用の取得・検索ツールは未実装で、能力はfalse。コマンド内ネットワークもwebFetchとwebSearchの両方がなければ拒否。通常の保存経路では両方falseなので通信できない。|
|スキル|未実装で能力はfalse。既存のスキルpayloadはあるが、本文だけでなく付属ファイルの安全な展開・参照をそろえる作業が残る。|

提示していない道具は呼び出し時も拒否する。コマンドとwriteAnywhere時の書き込みは、既定で別のtoolsなしOllama呼び出しにtrusted intentと操作を渡し、完全一致の `ALLOW` だけを受け付ける。これはClaudeのoperationCheckと同様の補助確認であり、OSの権限制限の代わりにはしない。確認が拒否・失敗したら実行を中止する。`operationCheck: false` で補助確認を無効にできる。

## Claude・Codexとの違い、残る制約

- Claudeのパス基準（作業場所、readableDirs、writeAnywhere）に合わせた。SDK固有のcanUseToolの共通化は行っていない。Ollamaのファイル操作はrealpathとOS制限も使う。
- コマンドの起動に必要なシステム実行ファイル・ライブラリ・共有キャッシュは読み取り可能。ファイルメタデータも参照可能。`/System` 全体や `/usr` 全体は許可せず、データ用ボリュームや `/usr/local` が範囲に入らないようにする。
- macOS以外のOS sandboxは未実装。macOSでもSeatbeltが利用できないときは失敗する。
- 現行ClaudeはBashにPC全体とWeb権限を要求する。OllamaはSeatbeltにより作業場所内への書き込み・ネットワークなしの組み合わせにも対応する。
- Webは安全な取得（DNS/redirect/ローカル接続/応答上限の扱い）を備えた実装が残る。検索サービスを登録したり、APIキーを設定したりしていない。
- スキルは既存の展開・付属ファイル制限をOllamaのsandboxと組み合わせる作業が残る。単なる本文投入をスキル対応とは申告していない。
- MEMORY.mdだけの読み書き例外、途中投稿ツール、差分編集、永続セッションは未実装。
- 通常利用への投入前に、外部レビュー、ハードリンク・ファイル競合・サンドボックス回避を含む追加検証、対応モデルでの継続運用試験が必要。
- 元のロビー差分とは `src/shared/api/mock/handlers/system.ts` など周辺のモック処理に関係があるが、元ツリーの変更ファイルを直接変更していない。統合時は未コミットのロビー差分との動作確認が必要。

検証結果と変更一覧は `docs/ollama-tools-validation.md` に記録する。

## 安全レビューの反映

読み取りレビューで、プロセスグループを離れた子孫の中断漏れ、stateDir祖先のrename、tools能力の重複値、モック保存検証の不一致の4点を指摘された。fork禁止と直接PID終了、祖先unlink拒否、show検証済み能力リストの採用、モック検証の統一を実施した。実Seatbeltで通常書き込み成功・祖先rename拒否・管理領域/追加読み取りフォルダからのhardlink拒否・中断を検証した。

## 仕上げ時の補足（2026-11-11）

- `enableTools` は既定falseで、既存SQLiteの `agents.backend_options` JSONへ保存する。DB migrationは追加していない。設定なしも無効として扱う。
- 子プロセス制約の確認済み例は `echo hello | /bin/cat` の拒否と `/bin/echo ready` の成功。git/npm/ビルド全般を実行確認したわけではない。外部コマンドの連結、gitのフック/外部ヘルパー、npmスクリプトやビルドツールなどforkを必要とする処理は失敗する見込み。単一プロセスで完結するgit操作まで一律に禁止しているわけではない。PATHはOS標準のみで、HomebrewやNodeを自動で使えない。
- 子孫プロセスを許可する将来設計では、終了時のプロセスグループkillに加え、setsid/setpgidによる離脱も防ぐ必要がある。実装・攻撃テストを含め2〜4人日の仮見積もり（OS方式調査による増加あり）。
- Web検索の接続先候補は今回未調査。検索APIの契約/鍵/送信内容と、取得先DNS・リダイレクト・ローカル接続の検証を設計してから導入する。
- CodexはApache-2.0として参照し、実コードやSeatbelt設定は転載していない。独自実装の `agent-runner/src/backends/ollama/tools.ts` 冒頭に本メモへの参照を記載する。


## チャンネル機能との統合（2026-11-11）

最新main 1e3f728への統合結果は `ollama-channel-validation-20261111.md` を参照する。Ollamaの有効化だけには追加移行を要しないが、チャンネルの作業フォルダ保存にはmigration 0005を追加した。指定フォルダではコマンドとスキルを無効にし、OS制限に加えて開いたファイルのinode・リンク数を確認する固定コードで読み書きする。成功したファイル読み取りは本文だけをモデルへ返す。通常モードのコマンドは従来どおりmacOSの単一プロセスに限る。
