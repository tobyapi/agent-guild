# Muse Spark backend

**実験対応・実API未検証。** readyはAPIキーとCLIの存在確認であり、接続成功を意味しない。

## ローカルHTTP検証（2026-11-09）

```powershell
./scripts/grok-wire/capture.ps1 -OutputDir D:/your-writable-test-directory -Backend muse
```

Grok用の検証器を共用する。Node.js 25以上とインストール済みの依存が必要だ。
出力先には検証専用の書き込み可能なフォルダを指定する。
接続先は127.0.0.1のみ、認証は固定ダミーキーであり、外部APIには転送しない。
Nodeからのspawn制限のため、実SDKが作った引数・環境を採取し、PowerShellから実CLIを起動する。
SDKの子プロセス起動そのものを通した統合試験ではない。

CLI 0.163.0 / SDK 0.167.0で2回のPOST `/v1/responses`を採取した。
`tool_choice:auto`、function形式・objectスキーマ・関数名の制約、
call_idに対応する結果返却、暗号化推論の再送、最終本文と完了イベントの受信を検査した。
初回にnamespace形式を検出したため、Museでも`features.multi_agent=false`を設定した。
CLIが無視した`model_supports_reasoning_summaries`は削除した。
模擬コマンドは環境のポリシーで拒否された。検査対象は拒否結果の返却であり、
コマンド実行成功やsandboxの実効性は未確認だ。

Metaによる要求全体の受理、引数deltaの結合、実ストリーム、画像、長い会話、
実APIのエラー・中断、他のCLIバージョンは未検証だ。
CLIはモデルメタデータが見つからずfallbackを使う。追加送信フィールドや
推論設定も含めた実API互換性は、このローカル検証では保証しない。
共通実行器ではprovider設定より共通設定を優先し、権限・秘密変数除外を保護する。

以下のSDKモックに関する説明に加えて、上記のローカルHTTP検証を実施済みだ。

Muse Sparkは既存のCodex SDK実行器からMetaのResponses APIへ接続する。
バックエンドIDは`muse`。Codex CLIと、アプリ起動環境の`MODEL_API_KEY`が必要だ。
APIキーは設定ファイルやbackendOptionsに保存せず、実行時の環境変数で渡す。
他社のキーはプロセス環境から除外し、子シェルには秘密変数を渡さない。
状態は`stateDir/muse-codex`に分離し、グローバルなCodex設定は変更しない。

対応モデルは`muse-spark-1.3`。空欄ならこれを選択する。
学習への入力利用条件が異なるcontributor版や、その他のモデルIDは実行前に拒否する。
推論の深さはminimal / low / medium / high / xhigh / max、既定はhigh。
APIキーの有効性や利用権限は実行時に判明する。probeは通信しない。

会話、画像、途中投稿、中断、ツール実行はCodex実行器を共用する。
Responsesの送受信、tool_choice:auto、ツール引数の処理、暗号化された推論の
引き継ぎはCodex CLIが担当する。アプリ独自のHTTP実装は追加していない。
権限の実行前チェック、sandbox、ネットワーク制御も既存Codexと同じ経路を通る。
readFilesやskillsを無効にした実行は拒否する。writeFilesにはrunCommands、
writeAnywhereにはwriteFilesとwebFetchが必要だ。MEMORY.md以外への書き込み制限など、
Codexのsandboxだけでは強制できない既存の限界も引き継ぐ。
Web検索は未対応として実行前に拒否する。Web閲覧はネットワークを許可したシェル経由だ。

SDKをモック化したテストで設定、権限制御、キー分離、会話、中断、エラー秘匿を検証する。
実APIへのリクエストは行っていない。実際のHTTP形式、ツールdelta結合、call_idの対応、
暗号化推論の再送についてはSDKモックでは検証できず、CLIとMeta APIの実機互換性は未確認だ。

仕様の根拠:

- [Meta公式のCodex接続手順](https://dev.meta.ai/docs/coding-agents)
- [Meta公式のツール呼び出し仕様](https://dev.meta.ai/docs/tool-calling)

## API key settings

Keys can be saved, updated and deleted in Settings > Backends on Windows.
Saved keys take precedence over environment variables. See [backend-api-keys.md](backend-api-keys.md).
