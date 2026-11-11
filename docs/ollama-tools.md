# Ollama の道具実行（試作）

## 有効化と要求形式

既定は会話専用です。macOS でバックエンドの詳細設定から `enableTools: true` を保存した場合だけ、役割の権限に従って操作します。保存値がない既存エージェントには道具を渡しません。UI・保存時の検証・実行時の権限計算に同じ条件を使います。

`toolProtocol` は既定 `auto`。Ollama `/api/show` が `tools` を返すモデルはネイティブの `tool_calls` を使い、それ以外の会話モデルはJSON操作を使います。`json` を選ぶと、能力の申告に関係なくJSON操作を使います。実機の `deepseek-r1:8b` は `tools` を申告しても操作を呼ばずに文章を返す場合があるため、作業には `json` を選んでください。能力の申告は依頼を実行できる保証ではありません。

モデル一覧の `ModelSpec.tools` は、アプリが道具を提供できるかを表します。macOSのローカル会話モデルではtrueです。ネイティブ対応の有無はランナー内部で別に判定し、非対応モデルにネイティブのtoolsを送信しません。モデル未検出・能力不明・macOS以外では保存時または実行時に拒否します。

## 共通の実行処理

両形式とも同じ権限検査・操作確認・Seatbelt・固定ファイル処理を使います。JSON形式は全フィールド必須の単一オブジェクトで、操作を1件ずつ受け取り、結果をモデルへ返します。ネイティブ形式は関数定義を渡し、`role: tool` に結果を返します。文章中のコードは実行しません。

| 操作 | 条件と制限 |
| --- | --- |
| `read_file` / `list_files` | readFilesが必要。通常は作業場所とreadableDirs内だけ。readAnywhereは非対応。writeAnywhereを持つ作業者はPC全体を読める。 |
| `write_file` | writeFilesが必要。親が存在するファイルへUTF-8全文を書き込む。writeAnywhereなしでは作業場所内だけ。管理領域は常に書き込み禁止。 |
| `MEMORY.md` | 道具の有効化後は、自分の作業場所のこのファイルだけ読み書き権限の例外。別ファイルへのリンクに例外を適用しない。 |
| `run_command` | runCommandsとreadFilesが必要。固定の `/usr/bin/sandbox-exec` 内で `/bin/sh -c` を実行。単一プロセスのみ。fork、パイプ、子プロセスを使うビルドは不可。外部コマンドのリダイレクトには `exec /bin/cat input > output` のようにexecを付ける。 |
| `read_skill` | skillsが必要。本文を返し、付属ファイルは既存のスキル展開処理で管理領域に一時展開する。読取範囲に追加し、実行終了時に削除する。 |
| `post` | 有効化後、空ではない途中投稿をランナーのonPostへ渡す。 |
| Web | 専用取得・検索ツールは未対応。webFetchとwebSearchはfalse。コマンドのネットワークも常に禁止。 |

ファイルはrealpathで範囲を確認し、Seatbelt内の固定Nodeコードで開きます。開いたファイルのinodeとリンク数を確認してから読み書きし、特殊ファイル・ハードリンク・実体の差し替えを拒否します。成功した読み取りは本文だけを返します。書き込み前の自動mkdirは行いません。

Seatbeltは既定拒否、管理領域への書き込みとその祖先の移動を禁止します。子プロセスへ親のトークン・プロキシ・シェル設定を渡しません。隔離の準備・起動に失敗しても、通常のシェルや無制限モードへ切り替えません。今回の統合で従来のJSON経路のCodex CLI sandboxを共通のSeatbelt処理へ置き換えたため、Codex CLIは不要です。JSON経路でもコマンドの読取範囲とネットワーク制限を緩めません。

コマンドとwriteAnywhere時の書き込みは、既定で別のtoolsなしOllama呼び出しにtrusted intentと操作を渡します。完全一致の `ALLOW` だけを受け付け、拒否・失敗では操作を止めます。これは補助確認であり、OS制限の代わりにはなりません。`operationCheck: false` で補助確認だけを無効にできます。

## チャンネルの作業範囲

チャンネル専用の作業場所・履歴境界・メモを維持します。指定フォルダモードでは、割り当てフォルダと専用作業場所だけを書き込み先にします。相談相手の成果物と添付は読取専用です。相談相手の `MEMORY.md`、範囲外へのリンク、ハードリンクは拒否します。コマンド・スキル・readAnywhere・writeAnywhereとの併用も拒否します。Rustで権限を絞り、ランナーと実行処理でも再検査します。

道具設定は既存の `agents.backend_options` JSONへ保存します。チャンネルの作業フォルダ保存にはリモート変更のmigration 0005を維持しています。

## 上限と残る制約

- 1実行5分、HTTP応答2MiB、会話履歴4MiB、道具の出力と書き込み32KiB、各子プロセス30秒。
- ネイティブは16ターン・合計64操作、JSONは40操作往復。中断・時間超過・出力超過では直接PIDとプロセスグループを停止します。forkはOS側で禁止しています。
- コマンド起動に必要なシステムの実行ファイル・ライブラリ・メタデータは読めます。通常のPATHはOS標準のみです。
- モデルが誤ったパス・本文を選ぶ、操作を呼ばない、読み取りを繰り返す、空回答を返す場合があります。操作イベントとディスク内容を照合してください。
- 永続セッションと差分編集は未実装。Windows/Linuxの道具実行と、配布アプリの画面操作は未検証です。

統合前の検証は [ollama-tools-validation.md](ollama-tools-validation.md) と [ollama-channel-validation-20261111.md](ollama-channel-validation-20261111.md)、統合後の記録は [ollama-merge-validation-20261111.md](ollama-merge-validation-20261111.md) を参照してください。

## 参照した実装

リモート変更は [openai/codex](https://github.com/openai/codex)（参照コミット `5228d94a27b7f84cae4854acbb5ea3b3e90dfeaf`、Apache-2.0）のツール振り分けとSeatbeltの既定拒否・固定パス・制限継承の設計を参照しています。ソース・ポリシーは転載していません。ネイティブ要求形式は [Ollamaのtool calling](https://docs.ollama.com/capabilities/tool-calling) に従います。
