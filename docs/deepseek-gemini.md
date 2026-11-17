# DeepSeek と Gemini Developer API

設定のバックエンド欄で API キーを保存し、エージェントのバックエンド・モデル・推論の深さを選ぶ。保存済みキーがなければ `DEEPSEEK_API_KEY` / `GEMINI_API_KEY` を使う。資格情報ストアの読込失敗時は認証エラーとし、環境変数への切替はしない。`GOOGLE_API_KEY` は参照しない。保存先は `AI-Guild/backend-api-key/deepseek` / `AI-Guild/backend-api-key/gemini` に分かれる。詳しくは [API キー設定](backend-api-keys.md)。

Gemini は **Developer API のみ**。Vertex AI、OAuth、GCP サービスアカウントには対応しない。ログイン方式の切替はない。probe の `ready` は利用するキーが取得できた状態を示す。API 接続、キーの有効性、残高や利用可能モデルは検査せず、probe で API 通信や課金は発生しない。

## モデルと API

2026-11-17 に公式資料を確認したカタログ。起動時のモデル取得は行わない。既定モデルは DeepSeek Flash と Gemini 4 Hydrogen。カタログ外の ID、非対応の推論設定、画像添付は HTTP 要求前に拒否する。

| バックエンド | モデル ID | 推論の深さ（既定 high） |
| --- | --- | --- |
| DeepSeek | `deepseek-flash`, `deepseek-v4-pro` | low / high / max |
| Gemini | `gemini-4-hydrogen` | low / medium / high / xhigh |
| Gemini | `gemini-4-argon`, `gemini-4-carbon` | low / medium / high |

DeepSeek は固定の `https://api.deepseek.com/chat/completions` に Bearer ヘッダで接続し、Chat Completions の SSE を読む。Gemini は固定の `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse` に `x-goog-api-key` ヘッダで接続する。キーは URL や要求本文へ入れない。リダイレクトと自動再試行は無効。エラー本文やネットワーク例外の生値は画面・ログへ返さない。HTTP 401/403 は認証エラー、429 は利用制限、404 はモデルエラーとして既存の Dispatcher へ返す。

## 道具と履歴

文章、権限内の `read_file`、`read_skill`、`fetch_url`、途中投稿の `post` を接続する。画像、ネイティブ検索、グラウンディング、書込、コマンド実行、MEMORY.md 更新、画像生成は非対応。モデル自体の能力と、このアダプタが提供する能力は異なる。画像・検索・書込の設定は対応済みとして申告しない。

Dispatcher とアダプタで元の権限を絞り、道具の宣言と実行時の両方で検査する。読取範囲、秘密の場所、リンクの検査と URL の公開アドレス検査は Grok と同じ共通部品を使う。利用可能なスキル本文・資産の読取だけを許す。SKILL.md 本文の読取成功は観測として報告し、本文中の使用申告とは分離する。資産だけの読取は SKILL.md 読込として数えない。

応答はストリーミングで受信して組み立てる。文字断片は保存発言にせず、受信中の activity と明示的な `post` を使う。最終結果は既存の会話保存経路へ返す。過去の会話は既存のプロンプト組立経路から渡り、プロバイダ側のセッションや共有履歴は使わない。

DeepSeek の `reasoning_content` と Gemini の opaque な `thoughtSignature` を、1回の実行内のツール継続にだけ保持する。Gemini は元の part の順序・署名位置を保ち、末尾の署名にも対応する。サーバーの call ID がない場合だけ実行内 ID を採番し、存在しない wire ID は捏造して返さない。推論本文・署名・継続状態をチャットや保存履歴へ書かない。

ストリームの正常終端と完了した引数を確認してから、バッチ全体を検査し逐次実行する。同じ call ID の再利用は拒否する。DeepSeek の `[DONE]` と正常 finish reason、Gemini の STOP と正常なストリーム終了を要求する。打切り・ブロック・不完全な SSE は成功として扱わない。取消は HTTP 受信を中断し、道具の前後とコールバック前に検査して後続の投稿や要求を止める。

上限は1実行5分、10要求、1バッチ20呼出し・合計40呼出し、引数32768文字、1要求/道具結果2 MiB、1応答4 MiB、1 SSE イベント1 Mi文字、出力指定16384トークン。キーは実行ごとに再読込する。モデル処理用の子プロセス・シェルは作らず、資格情報ストアの補助プロセスからも秘密名の環境変数を除外する。

## 検証範囲

Vitest で両アダプタ・Dispatcher・資格情報ストアのモック、React のキー操作とモデル/推論設定の保存後の再表示を検査する。ローカル HTTP サーバーでは実ソケットの分割 UTF-8 受信、ツール継続要求・認証ヘッダ、切断を検査する。SSE と取消・不正終端・権限・読込観測の境界もテストする。既存の IPC と `contracts/runner/requests.jsonl` の形式は変更しない。

実 API のキー有効性、モデル応答・課金、Windows 資格情報ストアと Tauri 画面の実機往復、長時間会話は未検証。ローカル HTTP 検査はテスト内の fetch 差替えで loopback へ送るもので、実 API の成功を示すものではない。機能非対応は上記「道具と履歴」に記載した範囲。

## 公式資料（確認日 2026-11-17）

- DeepSeek: [モデルと能力](https://api-docs.deepseek.com/quick_start/pricing/)、[Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)、[thinking と reasoning_content](https://api-docs.deepseek.com/guides/thinking_mode/)、[tool calls](https://api-docs.deepseek.com/guides/tool_calls/)
- Gemini: [Hydrogen と GenerateContent](https://aistudio.google.com/docs/whats-new-gemini-4-hydrogen)、[Hydrogen](https://aistudio.google.com/docs/models/gemini-4-hydrogen)、[Argon](https://aistudio.google.com/docs/models/gemini-4-argon)、[Carbon](https://aistudio.google.com/docs/models/gemini-4-carbon)、[GenerateContent wire 型・thinkingLevel・thoughtSignature](https://aistudio.google.com/api-reference/generate-content)、[thinking の API 間の署名の違い](https://aistudio.google.com/docs/thinking)、[API キー](https://aistudio.google.com/docs/api-key)、[function calling](https://aistudio.google.com/docs/function-calling)
