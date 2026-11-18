# Grok Web / X 検索の設計調査（段階1）

調査日: 2026-11-16 JST。担当: 白竜。
対象: `D:/agent-guild` のローカル main `1a825d0d0a8dcbded056ec2e9cc8b03892d5bfb9`。
成果物と試験用スクリプトは、この報告書と同じ作業フォルダだけに作成した。アプリ本体のコード変更、checkout/reset、push、タグ、リリースは行っていない。

## 改訂一覧（2026-11-16、Museレビュー反映）

- 6章を6.1～6.8の検証可能な完成条件に置換。申告値、Rust/TS契約、料金、書込隔離、SSRF、偽呼出し、秘密、統合範囲を具体化した。
- 制限付き書込は案(i)「OS隔離内の固定ヘルパー」を選択。既存local-fileの検査だけではTOCTOUを除去できないと明記した。
- 継続状態は `store=false`、`previous_response_id` 不使用、暗号化状態を含む出力をジョブ内メモリーで再送する方式に決定した。
- 1章末にxAI側のチーム後払い上限・キー単位レート制限と限界を追記。実アカウント設定は参照・変更していない。
- 5章に追加調査Bを追記。CLIの実験設定を1回オフライン検証し、namespaceが残ることを確認。追加のxAI API呼出し・課金は0回。
- 今回のアプリ参照時のHEADは `7ee5b2ca2c85df787203cd965f09ae80422c9ba1`。初版調査時の `1a825d0` から別作業で進んでいるため、初版の固定コミットでの実測と区別する。本依頼では本体を変更しない。

## 結論

**2a（xAI Responses API を直接呼ぶGrok専用ランナー）を推す。** 既存キーで `web_search` と `x_search` の両方が実際の出典付き結果を返した。一方、2bのCodex→MCP試験は、利用中のCodex CLIが送る `namespace` 型の道具をxAIがHTTP 422で拒否し、モデルによるMCP呼び出しに到達しなかった。2bを単に「小さなMCPを追加するだけ」と見積もる根拠は得られなかった。

2aでも隔離の全再実装は不要。すでにある `command-sandbox/role-command.ts` を使い、ファイルI/Oの安全処理はOllama・Claudeの既存実装からプロバイダー非依存部分だけを共通化できる。ただし、この共通化と新ランナーでの隔離は今回実装・実機確認していない。以下は実装前の設計である。

段階1の必須条件（直接APIで両検索の実結果確認、比較、設計）は満たした。実装開始・設計承認は本報告の対象外。

## 1. 現行公式仕様

### Live Searchと要求形式

- 旧 `search_parameters` / `web_search_options` / `live_search` は廃止済み。xAI公式TypeScript SDKの2026-10-16更新が、Responsesでは410になることと後継ツールを明記している。終了日そのものは、今回開いた一次資料からは確定しなかった。旧APIを試し直す課金試験はしていない。[公式SDK changelog](https://github.com/xai-org/xai-sdk-ts/blob/main/CHANGELOG.md)
- 後継は `POST https://api.x.ai/v1/responses`、Bearer認証。`tools` に `{"type":"web_search"}` / `{"type":"x_search"}` を渡す。アプリと同じ `grok-4.7` を試験した。[Web Search](https://docs.x.ai/developers/tools/web-search)、[X Search](https://docs.x.ai/developers/tools/x-search)
- Webは検索に加えてページ閲覧も行う。Xはキーワード・意味検索、ユーザー検索、スレッド取得をモデルが選ぶ。ドメイン・アカウント・日付の絞り込みが可能。画像・動画理解は今回要求しなかった。[Web Search](https://docs.x.ai/developers/tools/web-search)、[X Search](https://docs.x.ai/developers/tools/x-search)

最小形（キーはメモリー内からAuthorizationヘッダーにだけ挿入）:

```json
{
  "model": "grok-4.7",
  "store": false,
  "input": "検索したい公開情報",
  "tools": [{ "type": "web_search" }, { "type": "x_search" }]
}
```

### 応答と出典

本文は `output[].content[]` の `output_text`。Webの実行情報は `web_search_call`、今回のXは `custom_tool_call` / `name: x_keyword_search` だった。サーバー側ツールの生の検索結果本文はAPIの道具出力として取得できるとは限らず、最終要約と出典を主に使う。[Tool Usage Details](https://docs.x.ai/developers/tools/tool-usage-details)

公式説明では全訪問URLの `citations` と本文に付く `url_citation` annotationsを区別する。Responsesの本文内リンクは既定で有効だが、必ず引用する保証はない。**今回の生REST応答ではトップレベル `citations` は返らず、annotationsとWebの `action.sources` にURLがあった。** SDKの説明だけを根拠に `response.citations` 必須の実装にしない。Xのannotationsは `start_index=end_index=0` だったため、本文への位置挿入を無条件に行ってはいけない。[Citations](https://docs.x.ai/developers/tools/citations)

### クライアント側関数との併用

可能。公式のResponses例が `type:function` と `type:web_search` の混在を示す。クライアント側 `function_call` が来たらローカル側で実行し、対応する `call_id` の `function_call_output` を返して継続する。サーバー側検索をローカルの関数として実行してはいけない。`max_turns` の説明ではクライアント関数による中断・再要求でカウンターがリセットされるため、ランナー全体の上限を別に持つ必要がある。混在ループそのものは今回は実API試験していない。[Advanced Usage](https://docs.x.ai/developers/tools/advanced-usage)

### 料金（USD、2026-11-16参照）

| 項目 | 単価 |
|---|---|
| Web検索・閲覧 | 1,000回につき $5 |
| X投稿取得 | 1,000件につき $5 |
| Xユーザープロフィール取得 | 1,000件につき $10 |
| grok-4.7 短い文脈の入力 / キャッシュ入力 / 出力 | 100万トークンにつき $2 / $0.50 / $6 |
| grok-4.7 20万トークン以上の入力 / キャッシュ入力 / 出力 | 100万トークンにつき $4 / $1 / $12 |

検索料に加え、検索内容を読んだトークン・推論・最終回答が課金される。Xは2026-09-21以降、検索呼出回数ではなく取得件数が基準。利用量の `x_posts_fetched` / `x_users_fetched` を保存する。[Pricing](https://docs.x.ai/developers/pricing)、[Tool Usage Details](https://docs.x.ai/developers/tools/tool-usage-details)

`usage.cost_in_usd_ticks / 10^10` がリクエストの請求額。今回の直接3要求は合計 **$0.0722806**。Codex経由試験は422でusageが得られなかったため、その試験を含むアカウント請求総額までは断言しない。[Cost Tracking](https://docs.x.ai/developers/cost-tracking)

今回の既存キーでは追加契約・有料プラン変更の要求は出なかった。API利用料自体は発生した。他アカウントの利用資格や残高は未確認。

### 追加確認: xAI側の利用制限

チームの月次後払い上限がある。前払い残高を使い切り、後払い利用額が設定上限に達するとAPIが止まる。後払い上限は前払いの消費を制限せず、0設定でも残高は使える。厳密な1要求・1ジョブ上限の証拠にはならない。[Billing Management](https://docs.x.ai/developers/rest-api-reference/management/billing)

Consoleには自動チャージの有効/無効と月次チャージ総額の設定もある。既存チームの設定・残高・自動チャージ状態は今回確認・変更していない。[Billing](https://docs.x.ai/console/billing)

キー単位の `qps` / `qpm` / `tpm` と無効化・期限・ACLは公式仕様にある。TPM超過を起こした実行中要求は中断されない。今回開いたキー管理仕様に金額予算フィールドは確認できなかった。「キー単位の金額上限が絶対にない」とまでは断定しない。管理APIを呼ぶ権限・管理キーを推論キーから推測して利用しない。[Accounts and Authorization](https://docs.x.ai/developers/rest-api-reference/management/auth)

## 2. 2a / 2b 比較

| 観点 | 2a: xAIを直接実行 | 2b: Codex実行＋xAI検索MCP |
|---|---|---|
| Web / Xの実在する検索 | 直接APIで両方成功 | 検索サブ処理の直接APIは成功。外側のCodex→xAIがnamespace非対応422で停止 |
| 作業場所外への書き込み | ファイル道具の実体・リンク検証＋既存MXCコマンド隔離を適用。隔離不能時はコマンド禁止。新結合の検証が必要 | 通常のCodex sandboxを維持できれば既存どおり。ただしMCPサーバー自体はsandboxで保護されるとは扱わず、書き込み機能を持たせない |
| 読み取り専用の役 | writeFiles=falseでは書込道具を拒否し、MEMORY.mdだけ既存仕様の例外。コマンドは書込rootなし | 現行はMEMORY.mdのためworkspace-write。readAnywhere / writeFiles / runCommandsは仕組み上止められないと申告済み。厳密な読取専用にはならない |
| Web権限 | 実効権限からサーバー側toolsを作り、権限のない要求では一切渡さない | サーバー起動・ツール公開・実行処理すべてに権限ゲートが必要。標準web_searchは常時disabledにし、MCP検索のみ許可 |
| 外部送信 | アプリホストのAPI通信だけ許可。ローカルコマンドはネットワークなし | MCPはホストの通信権限でAPIを呼ぶ。Codexコマンドのnetwork=falseでも検索語の外部送信は可能になる |
| 変更量 | 中～大。Responsesイベント処理、関数ループ、権限付きI/Oを新規接続 | 通常なら小～中。ただし手元で互換失敗したため、CLI設定・バージョン制限・変換プロキシ等が別途必要になる可能性 |
| 壊れやすさ | xAI仕様を自分で追う必要。Codex由来の独自ツール形式から独立 | Codex CLI、SDK、MCP、xAIの複数境界。CLI更新でプロバイダー非互換が発生しうることを実測 |
| 料金・遅延 | 1つのGrok推論ループとその検索料 | 外側Grok＋検索用Grokの2推論、往復、要約の再入力。実額は未測定だが追加トークンが発生 |
| post / 進捗 | post関数をonPostに接続、最終回答との二重投稿を防ぐ | 既存EventReaderの途中agent_message処理を維持できる |
| 判定 | **採用推奨**。ユーザーの「Codex経由をやめる」にも直接対応 | 今回は採用しない。namespaceの非互換を回避できる設定は未確認 |

現在の制約は `codex-runtime/options.ts` のコードで確認した。古い `docs/role-permissions.md` には発案者Web不可の表が残るが、現在の `guild-domain/src/agent/templates.rs` では発案者のWeb検索・閲覧はともにtrue。実装時は現行の役割表とDispatcher計算を正とし、古い表で権限を上書きしない。

## 3. 推奨2aの設計

### 呼出経路と責務

`Dispatcher → grokAdapter → Grok Responses loop → xAI server tools / local tool dispatcher`。

- grokAdapterはモデル、能力、実効権限、キー取得、隔離可否の組立てを担当する。Codex SDK・CLIをGrokの実行要件から外す。他バックエンドには影響させない。
- Responsesクライアントは固定HTTPS endpoint、Bearer認証、キャンセル、応答サイズ、タイムアウト、SSE解析、usage抽出を担当する。キーを含むproviderエラー本文はログにも出さない。
- ローカル関数の実行は完全一致の登録名・JSON schemaで判定し、**ツール一覧で隠すだけでなく毎呼出しで権限を再検査**する。未知のfunction/custom_tool_callをコードとして実行しない。shell、remote MCP、code_interpreter、collections、画像生成は登録しない。
- `function_call` だけをローカル実行する。サーバー側 `web_search_call` / Xの `custom_tool_call` 等は進捗・利用量として処理する。call_id単位で副作用を重複実行せず、post/write/commandは順番に実行する。
- 全要求をstore=falseとし、previous_response_idは使わない。入力履歴・response.output・function_call_output・reasoning.encrypted_contentをジョブ内メモリーだけに保持し、続きの要求へ対応形式で再送する。ログ・DB・ディスクには保存せず、完了/キャンセルで参照を破棄する。再起動後の継続は初回範囲外。6.5のfixtureと混在ライブ試験で互換性を確認できなければ、保存方式を黙って切り替えず実装を止める。モデルの推論本文を利用者へ表示しない。[Advanced Usage](https://docs.x.ai/developers/tools/advanced-usage)

### 権限

| 条件 | 実装上の扱い |
|---|---|
| webSearch=trueかつwebFetch=true | server toolsにweb_searchとx_searchを追加。Web側の検索とページ閲覧は分離不能と扱う |
| webSearch=false | 両検索ツールを渡さない。後付けのユーザー・検索結果の指示で追加しない |
| webSearch=true / webFetch=false | GrokのpermissionRulesに `webSearch requires webFetch` を申告して検索を取り除く。閲覧を自動許可しない。2bでも同じ制約が必要 |
| webFetch=true / webSearch=false | 検索ツールで代用せず、明示URL用のfetch_urlだけを提供 |
| readFiles / readAnywhere | 役割の範囲とreadableDirsを判定。秘密の場所・管理領域は共通ファイルポリシーで除外 |
| writeFiles=true / writeAnywhere=false | 作業場所の実体の内側だけに書込可。readableDirsをwritable rootへ流用しない |
| writeFiles=false | MEMORY.mdの既存例外以外は拒否。コマンドのwritable rootも空 |
| runCommands=true | 既存runRoleCommandのOS隔離を利用。初期設計では作業者も同じ隔離経路、ネットワークなし。書込rootは役割に応じ作業場所のみ |
| 隔離を使えないOS/PC | runCommandsと制限付きwriteFilesをfalseにする。通常シェル・ホスト直接書込へフォールバックしない。MEMORY書込例外も利用不可と明示。検索・読取は別途検証した範囲で利用可能 |
| skills=true | 確定したスキル一覧と承認された展開先だけをread_skillで読む。スキルは権限の根拠にしない |

writeAnywhereが許される作業者の外部ファイル操作は、専用ファイル道具で明示パスを検証して行う。コマンド経由は上記のとおり狭くするため、既存Grokの無制限シェルより実行範囲が減る。外部リポジトリでのビルド等を同等に保つには別のOS隔離ポリシー設計が必要であり、初回実装の隠れたフォールバックにしない。

ファイル書込はパス文字列のprefix比較だけでは不可。UNC・デバイス名・ADSなどの危険な形を `tool-paths.ts` 相当で拒否し、既存親のrealpath、リンク、ハードリンク、開いたファイルの同一性を検証する。`ollama/local-file.ts` 冒頭のとおり、確認から操作までの差し替えを既存処理だけでは防げない。改訂では案(i)を選び、制限付き書込をOS隔離内の固定ファイルヘルパーで行う。理由はモデル制御のコマンドと同じ作業場所を扱い、パス検査だけを強制境界にできないため。親・実体検査は防御を重ねるために残す。隔離もリンク経由の脱出を防ぐと未検証のまま断言せず、6.3の実機試験を通るまで書込を有効にしない。writeAnywhere=falseのコマンド隔離を外すことはない。

MEMORY.mdは読取専用役でも認める書込の例外であり、任意の同名パス・外部リンクは許可しない。readAnywhere/writeAnywhereを許す場合も、資格情報・実行管理領域へのアクセスを除外する。`unrestricted` は新ランナーで実証できた結果に合わせて申告し、旧Codexの配列を無条件にコピーしない。

fetch_urlはHTTP(S)公開URLだけ、file/data/UNC・loopback・private/link-local・クラウドメタデータ宛を拒否し、DNSとリダイレクト先を毎回検査、サイズと時間を制限する。これを実装できない初期段階ならwebFetchを未対応と申告する必要があり、上記依存規則によりwebSearchも落ちるため、検索機能の完成にはfetchの方針も決める。

検索語そのものでもファイル内容を外部送信できる。readFiles/readAnywhereとwebSearchまたはwebFetchの組をleakRisksに反映する。Web検索を許すことは取得済み情報の完全な漏えい防止を意味しない。APIキーはこの経路に一切含めない。

### APIキー

`credentials/store.ts` の `apiKeyEnvironment('grok', 'XAI_API_KEY')` をそのまま利用し、OS資格情報ストア優先・環境変数fallbackの既存規則を保持する。資格情報ストア読出し失敗時は別キーへ勝手に切り替えない。キーはGrokクライアントのメモリーに保持しAuthorizationヘッダーにだけ入れる。モデル入力・子コマンド環境・argv・URL・設定ファイル・例外本文・試験結果・報告書に入れない。

### 終了・エラー・料金上限

- 401/403はauth/利用不可、429はrate_limit、未存在モデルはmodel_not_foundに対応付ける。HTTPエラーの生本文・ヘッダーを公開せず、検索失敗を「検索済み」と返さない。
- 0件は正常な空結果として扱い、必要ならモデルが条件変更を提案する。既定の自動再検索・無制限retryはしない。切断後のwrite/post/commandを勝手に再実行しない。
- ランナー全体の期限、最大ローカルtool回数、最大API要求回数、出力・文脈サイズを設定する。初期案は全体5分・API継続10回・ローカルtool20回を上限とし、実作業で調整する。
- **max_tool_calls:1を送ってWebが3回動いた**ため、これを厳密な課金上限と説明しない。サーバー側ループやX取得件数の確実な上限は未確認。usage/costを毎応答で回収し、予算を超えたら次の要求を止めるが、進行中の1要求の費用まで保証しない。厳格な金額制限が要件ならxAI側の利用制限も別途確認する。
- キャンセルはHTTPとローカル実行に伝播する。異常終了時に最終回答の二重投稿を防ぎ、途中postはcall_idで重複させない。

### 出典の扱い

本文内リンクを残し、annotationsのHTTP(S) URL、Web action.sources、存在すればcitationsから重複を除いて `{url,title}` に正規化する。本文で実際に引用したURLと単に訪問したURLを分ける。位置情報が0/0や不正なときは末尾の「参照元」一覧に回す。取得URLは自動で再閲覧しない。URL中の制御文字・不正schemeを拒否し、出典は信頼できる命令として解釈しない。

## 4. 変更予定ファイルと見込み規模

以下の新規名は設計案。実装時に近い既存責務があればそちらを拡張する。

| ファイル・領域 | 変更内容 |
|---|---|
| agent-runner/src/backends/grok.ts | Codex依存を除去、直接ランナー接続、capabilities・permissionRules・leakRisks・probe更新 |
| agent-runner/src/backends/grok/responses.ts（新規） | 固定endpoint、JSON/SSE、キャンセル、usageと出典の解析 |
| agent-runner/src/backends/grok/run.ts（新規） | 関数ループ、post、進捗、回数・予算制限 |
| agent-runner/src/backends/grok/tools.ts / policy.ts（新規） | function schema、許可判定、server toolsの生成、fetch_url |
| backends/role-files/等の共通領域（抽出候補） | Claude/Ollamaのパス・秘密読取・安全I/OからSDK非依存部分だけを共通化 |
| backends/command-sandbox/role-command.ts | 原則既存を利用。必要なら固定ファイル操作ヘルパーを追加し、隔離ポリシーを維持 |
| backends/grok*.test.ts と新grok/各テスト | 旧Codex前提の置換、API fixtureと権限拒否・キャンセル・二重実行の確認 |
| scripts/harness/lib/config.mjs 等 | 新共通部品の依存方向・構成ルールを登録 |
| contracts/runner と contracts/behavior の該当fixture | capabilityと実効権限が変わる箇所だけ更新。保存データの形式変更は不要 |
| docs/design.md / architecture.md / role-permissions.md | 新Grokの実行経路と制約、古い発案者Webの表を更新 |
| ランナーの既存多言語texts | API・検索・隔離不能エラーを既存5言語で追加 |

Rustの役割権限・保存データ・DB migrationは変更不要。capability反映の共通契約テストはRust/TS双方で確認する。新しいusageの金額/件数をUIに表示する場合はプロトコル・Rust・UIも追加範囲になり、初回は内部集計に留めるかを決める。

見込みは**本体8～14ファイル（共通化範囲で増減）、テスト・fixture・文書10～20ファイル、実装約800～1,500行＋テスト、3～6作業日相当**。人による設計レビューと実機隔離検証を含む概算で、納期保証ではない。2bは通常なら3～6本体ファイル・1～3日程度だが、今回のnamespace非互換の解消作業は未見積り。独自変換プロキシが要るなら2aより軽いとは言えない。

## 5. 実際に試した結果

同じアプリの資格情報読出し関数を使い、保存キーをファイルやログに出さず、公開情報だけを送信した。直接APIは**3回**。自前のretryなし。付加試験はCodex SDKの実行を**1回**行い、CLI内では同じ422に再試行して終了した。CLIのHTTP要求総数・全請求額は取得していない。

| 試験 | 要求の要約 | 応答の要約 |
|---|---|---|
| 直接Web | grok-4.7、tools=[web_search]、公式APIドキュメントを短く検索、store=false、max_output_tokens=1200、max_tool_calls=1 | HTTP200 completed、約11.8秒。Web3回、本文とurl_citation。13,705 input / 844 output tokens、$0.040946 |
| 直接X・初回 | tools=[x_search]、allowed_x_handles=[xai]、Grokに関する公開投稿、上限指定は同上 | HTTP200 completed、約11.2秒。x_keyword_search 1回、取得投稿0件、出典なし。$0.00788。API成功だけでは「実結果あり」と判定しなかった |
| 直接X・条件変更 | 同モデル、tools=[x_search]、アカウント・日付制限なし、Starship、3件以内を自然言語で要求、max_output_tokens=1800 | HTTP200 completed。x_keyword_search query=Starship / limit=3 / mode=Latest、投稿3件・ユーザー0件。7,078 input / 458 output tokens、$0.0234546。本文とX投稿URL3件のannotations |
| Codex→MCP再生 | SDK0.167.0、CLI0.163.0、同じxAI provider、専用CODEX_HOME、read-only、network=false、標準webSearch=disabled。取得済み結果を返す2つのMCP道具を登録 | HTTP422。tools[7].type=namespace がxAIの受付可能な型にない。MCPツールの呼出イベントなし。ライブのネスト検索は試していない |

Webの本文は公式ドキュメントURLを示したが、引用annotationは `https://r.jina.ai/https:/docs.x.ai/developers/tools/web-search` だった。これは検索APIの実際の出典として記録し、今回の仕様調査の根拠には直接開いた公式ページを使った。

Xが返したURL例: `https://x.com/i/status/2122102824263897136`。APIの出典付き検索結果が返ったことは確認したが、別途ブラウザーで当該投稿の存続・内容・時刻を検証していない。投稿内容を製品仕様の根拠にはしていない。

Codex試験のエラー要点（秘密を含まない部分のみ）:

```text
422 Unprocessable Entity
tools[7].type: unknown variant `namespace`
expected one of function, web_search, x_search, image_generation,
collections_search, file_search, code_execution, code_interpreter,
mcp, shell, tool_search
```

この422が通常のGrok全実行にも必ず起きるとまでは検証していない。今回のMCP構成で起きた互換性失敗であり、MCPサーバー自体のプロトコル不備を示す結果でもない。正式設定と新版の追加確認は以下のBに記録する。

MCPのcommand/args/env_vars/enabled_tools等の設定は公式OpenAI資料で確認した。[Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference)

### 追加調査B: mcp型・平坦化・新版（改訂時に1回）

公式のCodex設定リファレンスとMCP接続資料を確認した。`command` / `url` はCodexホストが接続するMCP transportの指定であり、モデル向けResponsesの `type:mcp` 素通しを指定する設定として説明されていない。`omit_tools_from` は公開面から道具を除く設定で、namespaceの平坦化ではない。今回調べた公開設定に、型をmcp/functionへ変換する設定は確認できなかった。[Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference)、[MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

手元のCLIは0.163.0。`features list` に実験設定 `non_prefixed_mcp_tool_names` があったため、これをtrueにした**1回のオフライン試験**を行った。既存SDK0.167.0＋既存stdio再生MCPを使い、providerを127.0.0.1だけに向け、仮の認証値を使用。実キーは取得せず、応答を422で終えるローカル受信先で、要求本文全体・ヘッダーを保存せず道具の型/名前だけを抽出した。

結果: `/v1/responses` の受信は1回。MCP道具は `type:namespace, name:guild_xai_probe, tools:[function web_search, function x_search]` のまま。`type:mcp` にはならず、functionとしてのトップレベル平坦化もされなかった。ローカル受信先の422は試験終了用の人工応答であり、新しいxAI実測422ではない。外部xAI要求0回、追加API料金0。成果物: `grok-codex-wire-probe.mjs`、`grok-codex-wire-results.json`、専用 `grok-wire-codex-home/`。

公式変更履歴の最新は0.169.0（2026-11-13）、npm公開版の問い合わせも0.169.0だった。公開履歴で今回の型互換性を解消する設定・修正は確認できなかった。新版のインストール・実行や全旧版の試験はしていないので、新版/旧版すべてが不可能とは言わない。[ChatGPT & Codex changelog](https://learn.chatgpt.com/docs/changelog)

xAIが受け付ける `type:mcp` は、`server_url` を指定してxAI側から遠隔MCPへ接続する方式。Codexがローカルstdio MCPを呼ぶ今回の経路とは別であり、そのまま置き換えるには外部到達可能なサービス・認証・権限伝達が追加で必要になる。[Remote MCP Tools](https://docs.x.ai/developers/tools/remote-mcp)

結論: 2bが小さな設定変更で動く根拠は得られず、2a推奨を維持する。2bの原理的不可能性を主張するものではない。namespaceをfunctionへ変換する独自プロキシなら理論上候補だが、戻り値の名前・呼出しID・ストリームの逆変換まで含む未検証の別開発になる。これを成功済み・軽量な代替とは数えない。2bが動きそうだと確認できた場合の停止条件には今回は該当しない。

### 再現用成果物

- `grok-search-probe.mjs` / `grok-search-probe-results.json`: 直接Webと初回X。
- `grok-x-reprobe.mjs` / `grok-x-reprobe-results.json`: 条件変更後の直接X。
- `grok-search-replay-mcp.mjs`: 取得済みの結果だけを返すstdio MCP。API・ファイル書込機能なし。
- `grok-codex-mcp-probe.mjs` / `grok-codex-mcp-results.json`: Codex経由試験。結果JSONはエラー有無のみ記録。
- `grok-probe-codex-home/`: この試験専用のCLI状態。既存アプリ・普段のCODEX_HOMEは変更していない。

再実行は課金・状態作成を伴う。今回の結果を読むだけならJSONを参照する。

## 6. 実装の完成条件と残るリスク（改訂）

以下は今後の実装を受け入れる条件。今回の設計改訂で実装・安全性検証が済んだという意味ではない。各項はテスト名、fixture、実機のOS/CLI/隔離方式、結果ログを実装報告へ添付し、未実施をPASSに数えない。

### 6.1 申告値・権限契約

新ランナーの申告目標は次のとおり。trueは道具を持つという意味で、役割の許可を増やさない。実証できない能力はfalseに落とし、検索を含む必須条件が欠ければ未完成と報告する。

| フィールド | 新しい値・条件 |
|---|---|
| capabilities.webSearch / webFetch | true / true。server toolsと安全fetchの両方が完成条件を満たす場合のみ |
| capabilities.readFiles / readAnywhere | true / true。専用読取道具の範囲検査・秘密除外の実証が条件 |
| capabilities.writeFiles / writeAnywhere | false / false on every OS. No file-write or MEMORY exception tool is registered. |
| capabilities.runCommands | false on every OS. No shell or command tool is registered. |
| capabilities.skills | true。確定スキル一覧と認可済み配置先からの読取に限定 |
| permissionRules | `[{when:'webSearch',requires:['webFetch']},{when:'writeAnywhere',requires:['writeFiles']}]`。writeFiles→runCommandsやwriteAnywhere→webFetchという旧Codex依存は移植しない |
| leakRisks | `[['readFiles','webSearch'],['readAnywhere','webSearch'],['readFiles','webFetch'],['readAnywhere','webFetch']]`。コマンドnetwork=falseでも検索語/URL/本文による送信は残るため明示する |
| unrestricted | 目標 `[]`。旧Codexの配列コピーは禁止。権限falseの動作を新ランナーで実証した結果のみ申告。強制不能な操作はまず能力停止/要求拒否とし、空配列を先に安全性の証拠にしない |
| midRunPost / frameGeneration | 'text' / false。既存の別画像生成経路は変更しない |

- Rustのusable_permissions、TSのusablePermissions/supportedPermissions、probe→UIの共通契約fixtureで具体値を照合し、256通りの権限で実効値が付与権限の部分集合になることを確認する。能力停止環境のfixtureも含める。
- Webなしでは要求toolsにweb_search/x_searchを含めない。webSearch=true/webFetch=falseでも除く。readFiles/readAnywhere/writeFiles/writeAnywhere/runCommands/skillsの各拒否を、偽呼出しを使って実行直前にも確認する。run開始後も各継続要求と各ローカル呼出しで、ホストが持つ実効権限・ジョブ状態を再検査する。API出力は権限情報として採用しない。
- leakRisksは取得済み入力・スキル・履歴等すべての非送信を保証するものではない。APIへのモデル入力自体の外部送信はこの配列とは別の既存仕様である。

### 6.2 料金制御と表示

- 1ジョブ（利用者の1ターン）に属する全Responses要求のusageを累積し、予算以上なら次要求を送らない。ローカル関数から再開するたびに予算をリセットしない。予算・最大要求数・実行期限を開始時に固定する。
- `cost_in_usd_ticks` を整数単位で集計し、表示時だけ10^10で割る。入力/出力/キャッシュtoken、Web呼出回数、X投稿/ユーザー取得件数を別々に数える。同一response IDのSSE中間/完了イベントを二重加算しない。usage欠落・不正値・切断時は費用不明とし、予算0とは扱わず次要求を停止する。
- fixtureで複数応答の加算、ちょうど上限、超過、重複イベント、0件でもtoken料金あり、Web3回、X投稿/ユーザーの別件数、欠落usage、キャンセルを検証する。providerの総額に道具料金を二重加算しない。
- 画面と既存5言語の文書/文言に「ターンごとに集計し、上限に達したら次の要求を止めます。実行中の1回分は超過することがあります。厳密な課金上限ではありません」を明示し、文言/表示の確認を残す。初回は金額/件数の新しい表示プロトコルを増やさず、ランナー内の集計と既存の制約説明欄・安全な終了理由で伝える。適切な既存表示先がなければ、その説明用変更を範囲に加える。
- 1章のxAI側制限を文書へ反映する。既存チーム/キーの設定は自動変更しない。厳密上限を要求された場合は別要件として止め、月次上限やmax_tool_callsで満たしたとは言わない。

### 6.3 Read-only boundary (B, approved 2026-11-16)

- B replaces the previous fixed file helper / command sandbox scope. runCommands, writeFiles and writeAnywhere are false on Windows, macOS and Linux. MEMORY.md updates have no exception. Explain this in the existing limits description in all five languages, including for existing Grok agents.
- Do not register write, command or MEMORY tools. Recheck registered names, effective grants and cancellation immediately before executing a local function. Reject fabricated calls independently of model instructions.
- Prove all three absent capabilities using each OS declaration and all 256 grant combinations, the shared Rust/TS contract fixtures and fabricated calls. Do not copy the old Codex unrestricted list; report only experimentally supported values.
- Read tools must reject workspace hardlinks, junctions and symlinks that could bypass known-secret or management-area exclusions. Reject link count >=2, reject reparse/symlink components, resolve paths and compare the opened handle identity to pre/post path identity. Apply this policy to skill file assets and explicit host image attachments too.
- Prove normal reading and rejection of hardlink/junction/symlink fixtures. State where real OS behavior has not been exercised; simulated OS capability tests are not filesystem tests on those OSes.
- Shared runInSandbox / runRoleCommand, claude/command.ts and ollama/windows-command.ts are out of scope. No isolation attack probes belong to B. A need to change those components is a stop condition.

### 6.4 fetch_urlと出典

- http/httpsだけを許可。制御文字、不正scheme、URL内資格情報、loopback/private/link-local/クラウドメタデータ宛、IPv4/IPv6およびIPv4-mapped表現を拒否する。DNS応答に非公開IPが混じる場合も拒否する。
- DNSの検査結果と実際の接続先を固定/照合し、接続時の再解決で検査を迂回させない。リダイレクトは手動処理で各ホップのURLと解決IPを再検査する。再試行/再解決があるたびにも同じ検査をする。
- 初期上限は展開後本文2 MiB、取得全体15秒、リダイレクト5回。ストリーム受信・圧縮展開中にも制限し、Content-Lengthだけを信用しない。AbortSignalを伝播し、上限到達時は成功として返さない。
- fixtureで公開→privateリダイレクト、DNS rebinding、複数A/AAAA、特殊IP表現、不正URL、無限リダイレクト、過大/圧縮本文、遅延、キャンセルを検証する。取得内容は非信頼資料として囲み、命令/権限に変換しない。
- annotations/sources/citationsの欠落・重複・不正scheme・制御文字・0/0位置を検証し、0/0は末尾参照へ回す。リンクを自動fetchしない。ローカルfetchの対策をxAIサーバー側検索の宛先制御の証明には使わない。

### 6.5 道具の識別・一度だけの実行・状態

- ローカル実行は登録済みfunction_callだけ。名前完全一致・引数JSON/schema・サイズ・実効権限を検査する。未知名/未知type/偽custom_tool_callを拒否し、function_callがweb_search/x_searchを名乗っても手元で実行しない。server toolsの出力は進捗/usage/引用としてのみ扱う。
- call_idをジョブ全体で管理し、受信順に逐次実行する。同一ID/同一内容の再出現は保存済み結果を再利用し、副作用は再実行しない。同一IDで名前/引数が異なる場合や空ID、出力だけ先に来る不正順序は拒否する。開始済みで完了不明の副作用は再実行せずジョブを止める。台帳はジョブ内メモリーのみで、再起動復帰は行わない。
- SSEの途中argumentsで実行しない。応答完了・呼出し確定後にのみ実行し、各実行直前にcancel状態を調べる。cancel後は新規write/post/command/次要求を開始せず、実行中のHTTP/子プロセスへ中断を伝播する。既に完了した副作用の取消は保証しない。
- fixtureで未知名/不正引数/サーバー名の偽装、custom_tool_call、重複/衝突ID、順序、途中SSE、キャンセル直前/実行中/実行後、通信切断後の再送を検証する。write/post/commandの実行回数が最大1であることを観測する。
- 継続方式は3章のとおりstore=false＋encrypted_content再送、previous_response_idなし。公式例を根拠とする設計で、今回の追加ライブ試験は未実施。fixtureで全要求のstore=false、履歴と対応するfunction_call_outputの保持、暗号化状態の欠落時停止、ディスク/ログ不保存、終了時破棄を確かめる。[Advanced Usage](https://docs.x.ai/developers/tools/advanced-usage)

### 6.6 キーとエラーの非漏えい

- grok.tsのfailure()方針を継承し、providerのエラー生本文/ヘッダー/リクエストオブジェクトをログ・チャットへ出さない。分類コードと固定の安全な文言に写す。キーは資格情報ストアからクライアント内メモリーへ渡し、固定xAI endpointのAuthorizationだけに使う。
- 合成canaryキーを使い、モデル入力、function結果、子プロセスenv/argv、URL、設定、SSEデバッグ、ログ、例外、post/最終回答に含まれないことを確認する。エラー本文/ヘッダーがキーを反射するfixtureも含める。資格情報取得失敗時の別キーへの無断切替を拒否する。実キーそのものを期待値としてテストファイルに保存しない。

### 6.7 統合範囲・障害fixture

- Initial B scope: normal chat, Web/X search, authorized local reads, read_skill from the supplied list, onActivity, onUsage, onPost and final output. Existing explicit host image attachments retain path checks. Local writes, commands and MEMORY updates are excluded on every OS. New image-generation tools, automatic skill installation, remote MCP and restart recovery remain excluded. Existing separate image-generation backends are unchanged.
- postは実効ジョブ状態を確認しcall_idで重複防止。途中投稿と最終回答を二重投稿しない既存契約を維持する。スキル本文/画像/検索結果の偽指示で権限が増えないことを統合fixtureで確認する。
- 0件、401/403、429、5xx、不正JSON、SSE途中切れ/壊れたイベント、出力上限、usage欠落、引用なし/0/0、検索＋関数の混在、キャンセル、二重postをfixtureで検証する。再試行は上限内でも副作用を再実行しない。初回既定は失敗後の自動再試行なし。
- 新ランナーを使う最小ライブ統合試験で、両検索の出典付き実結果と、検索→ローカル関数→継続→最終回答を確認する。ライブ課金・送信内容は実装依頼の範囲で別途扱う。今回の旧直接API成功を新ランナー統合成功に数えない。画像入力/スキル/postは別fixtureでよく、実行していない実機項目を明記する。

### 6.8 Approval and verification status (B)

The user approved B then C on 2026-11-16. B is search/read-only on every OS, including existing Grok agents. The old writable helper proposal is superseded for B. C owns shared isolation separately.

Transport uses store=false and stream=false. SSE is not requested; unexpected SSE/partial data must fail closed without executing incomplete calls. The fixtures use completed JSON responses. Cancellation still propagates to active HTTP requests.

Live B evidence: Web search -> read_file -> encrypted-state replay -> final answer: 2 API requests, $0.02145. X search with one actual public post citation: 1 request, $0.016294. Total $0.037744 of the $0.50 authorized cap; no additional calls are required just to reproduce these results. Raw encrypted state and provider bodies are not stored.

OS verification: Windows 10.0.26200 / Node 25.2.1. Capability declarations are also fixture-tested as darwin/linux, which does not establish real filesystem behavior on those systems. Image, skill and post live tests, long-running jobs, strict in-flight spend caps and deployed UI behavior remain unverified. Security review is required before main integration. Missing fixtures or checks must be listed as incomplete, not PASS.
