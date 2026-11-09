# Grok通信境界の検証

2026-11-09、Codex CLI 0.163.0 / Codex SDK 0.167.0で実施した。
これはローカル模擬APIとの通信検証であり、xAI実APIへの接続試験ではない。

## 再実行

Windows PowerShell、Node.js 25以上、依存インストール済みのリポジトリで実行する。

```powershell
./scripts/grok-wire/capture.ps1 -OutputDir D:/your-writable-test-directory
```

`OutputDir`は検証専用の書き込み可能なディレクトリを指定する。
`requests.json`、`cli-events.jsonl`、`launch.json`、専用CODEX_HOMEを保存する。
APIキーは固定のダミー値のみ使用し、APIサーバーは127.0.0.1にだけバインドする。
既存の環境変数やグローバル設定は変更しない。外部APIへ転送する経路はない。

NodeからのspawnがEPERMになる環境のため、実際の`runCodex`とSDKを使い、
spawn直前で引数と環境を採取する。その引数・環境でPowerShellから実CLIを起動する。
SDKの子プロセス起動自体を通した統合試験にはなっていない。

## 観測と修正

- 修正前は`tools`に`type: namespace`の`multi_agent_v1`が入った。
  xAIの公開されたfunction tool仕様との互換性を確認できないため、
  Grokだけ`features.multi_agent=false`にし、修正後にこの形式が消えたことを確認した。
- `model_supports_reasoning_summaries=false`はCLIに無視された。
  `model_reasoning_summary=none`へ置き換えると、送信された`reasoning.summary`が消えた。
- 修正後は全ツールが`type: function`、`parameters.type: object`になった。
- `reasoning`は`{"effort":"high"}`、`include`は`reasoning.encrypted_content`を含む。
- 模擬APIが返した`function_call`と`reasoning`をCLIが受信し、次のPOSTで
  `function_call_output`を同じ`call_id`に対応付けて返した。
  暗号化推論項目の`encrypted_content`も次のinputへ保存された。
- 模擬SSEの`response.output_item.done`、`response.completed`から最終本文を受信した。
- `Write-Output 'wire-test'`の実行は環境ポリシーで拒否された。
  観測できたのは拒否結果の返却であり、コマンド実行成功やsandboxの実効性ではない。

`verify.mjs`は2回のPOST、ツールの形式、推論項目の再送、結果のcall_id、
最終本文と完了イベントを検査する。CLI更新で送信形式が変われば失敗する。

## 仕様との照合と限界

[xAI Function Calling](https://docs.x.ai/developers/tools/function-calling)の
function定義・結果返却形式と、
[xAI Reasoning](https://docs.x.ai/developers/model-capabilities/text/reasoning)の
effort・暗号化推論項目の再送形式に対応することを確認した。
推論要約を無効にする設定は[OpenAI公式設定例](https://learn.chatgpt.com/docs/config-file/config-sample)を参照した。

ただし、要求全体のxAI受理は未確認だ。CLIは`client_metadata`、`prompt_cache_key`なども送る。
追加フィールド、モデルメタデータのfallback、実ストリーム、画像、長い会話、
認証・利用枠エラー、中断、CLIの他バージョンは実API検証が必要だ。
別バージョンでcustom toolやnamespaceが残る場合は、そのまま通常対応にせず、
当該CLIでの設定調整、または双方向の通信変換が必要になる。
