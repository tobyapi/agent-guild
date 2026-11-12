# バックエンドのAPIキー設定

設定 → バックエンドで、APIキーを保存できると申告しているバックエンド（`BackendInfo.setup.apiKey`。いまは Grok と Muse Spark）の欄から、APIキーを保存・更新・削除する。
入力はpasswordフィールドで伏せ字にし、送信開始時と画面を閉じたときに入力値を破棄する。
保存済みキーを読み戻して画面に表示する機能はない。

- 優先順位は、保存済みキー → アダプタが申告した環境変数（`setup.apiKey.envVar`。Grokは`XAI_API_KEY`、Museは`MODEL_API_KEY`）。
- 削除すると保存済みキーだけを消す。環境変数が残っていれば、引き続き認証に使う。
- キーはprobeと実行開始のたびに読み直す。変更完了後の次の実行から反映する。
  実行中のSDKは開始時のキーを保持する。環境変数自体の変更にはアプリの再起動が必要。
- 保存先はWindows資格情報マネージャーの汎用資格情報。
  名前は`AI-Guild/backend-api-key/<バックエンドのID>`で、バックエンドごとに分ける。
  現在のWindowsユーザー・端末で永続化し、アプリのデータフォルダやSQLiteには保存しない。
  同じWindowsユーザーのアプリインスタンス・データフォルダ間ではキーを共有する。
- 現在、安全な保存に対応するのはWindowsのみ。他OSは従来の環境変数認証を使う。
- Windows PowerShellの固定プログラムから`CredReadW`／`CredWriteW`／`CredDeleteW`を呼ぶ。
  キーは標準入力で渡し、引数・スクリプトソース・通常設定・ログへ埋め込まない。
  ヘルパーの標準エラーや生の例外は公開しない。IPCの状態応答はsourceとsupportedのみ。
  操作はバックエンドごとに直列化し、タイムアウトは15秒。
- 資格情報ストアを読めないときは認証エラーにする。別のキーへの切り替えや平文保存はしない。
  PowerShellの制限言語モードやアプリ制御でAdd-Typeが拒否される環境では利用できない。
- OSの同一ユーザー権限を持つ別プロセスからの取得を防ぐ機構ではない。
  既存のエージェントsandboxの制約は`grok.md`と`muse.md`を参照する。

APIキーは1行・UTF-8で2560バイト以内。空白だけのキーや改行・NULを拒否する。
保存時に前後の空白を除く。画面の成功表示は保存の完了を示し、API接続の成功を示さない。

## 契約と検証

React → Rust: `backend_api_key({ backendId, action, key? })`。
actionはstatus／set／deleteで、setだけkeyを渡す。
戻り値は`{"source":"saved|environment|unset","supported":true|false}`形式のJSON文字列。
Rust → runner: `apiKey`要求。既存のresult／errorで完了し、成功時にbackendsを再通知する。
`contracts/runner/requests.jsonl`に、秘密を含まないstatus要求の実例がある。

Vitestで保存・更新・削除・環境変数への復帰・バックエンド分離・操作順序・エラー秘匿を検査する。
SDKモックで実行ごとのキー再読込と他方のキー除外を検査する。
Windows資格情報ストアとTauri画面の実機での往復は未検証。有料APIは呼び出していない。

Windows APIの構造体と永続化の根拠:
[Microsoft CREDENTIALW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw)、
[Microsoft CredWriteW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credwritew)。
