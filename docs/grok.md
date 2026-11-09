# Grok backend

**実験対応・実API未検証。** 選択画面にも同じ表示を出す。readyはキーとCLIの存在確認のみで、接続成功ではない。

ローカル実CLIの通信採取と仕様照合は[grok-wire.md](grok-wire.md)を参照。Codexのマルチエージェント機能はxAIへ未確認のnamespace形式を送るため無効にしている。

GrokはCodex SDKの実行器から、xAIのResponses APIへ接続する。
アプリを起動する環境に`XAI_API_KEY`を設定する。キーをエージェントの
backendOptionsやsettings.jsonへ保存しない。Codex CLIのインストールも必要だ。
GrokのWeb版ログインやサブスクリプションは、この認証の代わりにはならない。

既定のモデルは`grok-4.7`。推論の深さはlow、medium、high、xhighから選べる。
カタログにないモデルIDは既存の自由入力を使える。モデルへのアクセス権と
APIキーの有効性は実行時に判明する。probeは通信せず、キーの有無だけを確認する。

会話、画像入力、途中投稿、中断、ファイル操作、コマンド、スキルの実行経路は
既存Codex実行器を共用する。Grok専用のCODEX_HOMEをstateDir/codexに置き、
モデルプロバイダ、接続先、環境変数を実行ごとに渡す。グローバル設定は変更しない。
キーはプロバイダ設定やコマンドライン引数に含めず、子シェルの環境変数からも除く。

Web検索とX検索は未対応で、要求されたら実行前に拒否する。
Web閲覧はCodex同様、ネットワークを許可したコマンドによる取得となる。
Codexの権限制御の限界も同じだ。readFilesとskillsを無効にした実行は拒否し、
writeFilesにはrunCommands、writeAnywhereにはwriteFilesとwebFetchを必要とする。
操作確認とsandboxの設定は既存Codexの経路から引き継ぐ。

この変更はSDKをモックしたテストで検証した。実際のxAI APIでの会話、画像、
ツール実行、ストリーム中断の互換性は未検証で、導入前の実機確認が必要だ。
エラー本文に認証情報が混ざる可能性があるため、Grokからの生エラーは投稿せず、
エラーコードと一般的な案内を返す。

仕様の根拠:

- [Grok 4.7](https://docs.x.ai/developers/grok-4-7)
- [xAI Responses API](https://docs.x.ai/developers/rest-api-reference/inference/responses)
- [Codex provider configuration](https://learn.chatgpt.com/docs/config-file/config-reference)

Muse Sparkの接続は[muse.md](muse.md)を参照。DeepSeekには変更を加えていない。

## API key settings

Keys can be saved, updated and deleted in Settings > Backends on Windows.
Saved keys take precedence over environment variables. See [backend-api-keys.md](backend-api-keys.md).
