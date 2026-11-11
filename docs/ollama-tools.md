# Ollama の道具実行（試作）

## 有効化と要求形式

既定は会話専用です。バックエンドの詳細設定から `enableTools: true` を保存した場合だけ、役割の権限に従って操作します。ファイルの読み書き・一覧、スキル参照、途中投稿はどの OS でも使えます。コマンドの実行は OS の隔離の中でだけ使います（macOS の Seatbelt と、対応する Windows 11 の MXC）。作業フォルダの外への書き込み（writeAnywhere）は macOS だけです（下の「Seatbelt のない OS」）。保存値がない既存エージェントには道具を渡しません。UI・保存時の検証・実行時の権限計算に同じ条件を使います。

`toolProtocol` は既定 `auto`。Ollama `/api/show` が `tools` を返すモデルはネイティブの `tool_calls` を使い、それ以外の会話モデルはJSON操作を使います。`json` を選ぶと、能力の申告に関係なくJSON操作を使います。実機の `deepseek-r1:8b` は `tools` を申告しても操作を呼ばずに文章を返す場合があるため、作業には `json` を選んでください。能力の申告は依頼を実行できる保証ではありません。

モデル一覧の `ModelSpec.tools` は、アプリが道具を提供できるかを表します。ローカル会話モデルではtrueです。ネイティブ対応の有無はランナー内部で別に判定し、非対応モデルにネイティブのtoolsを送信しません。モデル未検出・能力不明では保存時または実行時に拒否します。

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

ファイルはrealpathで範囲を確認し、macOS では Seatbelt内の固定Nodeコードで開きます。開いたファイルのinodeとリンク数を確認してから読み書きし、特殊ファイル・ハードリンク・実体の差し替えを拒否します。成功した読み取りは本文だけを返します。書き込み前の自動mkdirは行いません。

## Seatbelt のない OS（Windows・Linux）

役割の権限は同じですが、使う操作を絞ります（`BackendInfo.capabilities` で申告。role-permissions.md）。

- **使う**: `read_file` / `list_files` / `write_file`（作業場所と readableDirs の中だけ。書き込みは作業場所だけ）、`MEMORY.md` の例外、`read_skill`、`post`。
- **Windows 11 で隔離が使えるときだけ使う**: `run_command`。共通の隔離（MXC。command-sandbox.md）の中で Windows PowerShell の文として動かす。見えるのは作業場所・readableDirs・道具のフォルダだけで、通信はできない。子プロセスやパイプは使える（macOS の単一プロセスの制限はない）。隔離が使えない PC（古い Windows・Linux）では使わない。
- **使わない**: writeAnywhere（管理領域などを OS で守れない。役割が許していても作業場所の外には読み書きしない）、指定フォルダモード（リンクの差し替えを OS で止める前提のため、実行を拒否する）。

ファイル操作はランナーのプロセスの中で行います（`ollama/local-file.ts`）。Seatbelt 版の固定コードと同じ確認をします: 実体を解決して範囲を判定したあと、開いたファイルが判定した実体そのもの（同じファイルで、ハードリンクなし）であることを確かめてから、読む・中身を消して書く。Windows のネットワークパス（`\\` で始まるパス）と代替データストリーム（「:」を含むパス）は、実体を調べる前に断ります（`tool-paths.ts`）。

OS の隔離がないので、確認から操作までの間に別のプロセスがファイルやリンクを差し替える競合は止められません（Claude のファイル道具と同じ強さ）。確認のあとに書き込み先が差し替えられた場合、新規作成では空のファイルが作られたあとで拒否することがあります。

## Seatbelt（macOS）

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
- 永続セッションと差分編集は未実装。Windows のファイル道具は自動テスト（実ファイルの読み書き・リンク・ハードリンク・差し替えの拒否）で検証済みですが、実モデルでの通し実行と Linux、配布アプリの画面操作は未検証です。

統合前の検証は [ollama-tools-validation.md](ollama-tools-validation.md) と [ollama-channel-validation-20261111.md](ollama-channel-validation-20261111.md)、統合後の記録は [ollama-merge-validation-20261111.md](ollama-merge-validation-20261111.md) を参照してください。

## 参照した実装

リモート変更は [openai/codex](https://github.com/openai/codex)（参照コミット `5228d94a27b7f84cae4854acbb5ea3b3e90dfeaf`、Apache-2.0）のツール振り分けとSeatbeltの既定拒否・固定パス・制限継承の設計を参照しています。ソース・ポリシーは転載していません。ネイティブ要求形式は [Ollamaのtool calling](https://docs.ollama.com/capabilities/tool-calling) に従います。
