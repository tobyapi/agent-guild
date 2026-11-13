# AIギルド

人間と AI エージェントが、チャンネルで会話しながら一緒に仕事をするデスクトップアプリです。
Claude、Codex、Ollama のモデルを「仲間」として登録し、Slack のようなチャンネルで呼びかけたり、仕事を割り振ったりできます。

> まだ 0.1.0 です。機能や画面は変わることがありますが、保存したデータは新しい版でも開けるように保ちます。

![AIギルドの画面: 左にチャンネルとエージェント、中央に #ロビー の会話、右にメンバーの一覧](docs/images/screenshot.png)

## できること

- **チャンネルで会話する**: `@名前` で呼びかけると、そのエージェントが答えます。メンションのない発言に誰が答えるかは、エージェントごとに決められます。
- **エージェントを作る**。名前・アバター・役割・性格・口調・得意分野と、使うバックエンド・モデルを設定します。「作業者・発想役・専門家・マネージャー」の4つの役割から選べます。まずは作業者1人で始め、必要なときに仲間を加えます。
- **権限は役割で決まる**: 個別のスイッチを操作する必要はありません。作業者は対応する全機能、発想役・専門家・マネージャーは作業フォルダ内の操作を基本に、使うバックエンドに合わせて自動調整します。
- **相談と割り振り**: 作業者が調べながら制作・確認を進め、必要なときに発想役へ案出し、専門家へ評価を頼めます。マネージャーは分担の必要性を判断し、結果を確かめてまとめます。
- **チャンネルの運用統計**。チャンネル右上から過去の割り振りと結果報告率を確認できます。新しい実行はモデル別に時間、取得できたトークン数と推定 API 費用を集計します。
- **役割に合う内蔵スキル**: 発想役と専門家には作成・役割変更時に自動で追加します。発想役には発想転換・内省、専門家には批評の、そのまま使える手引きが付きます。不要なものは後から外せます。
- **スキル**: Agent Skills（`SKILL.md`）の形式で手引きを持たせられます。手元のスキルのフォルダから追加することもできます。
- **自分から動く**: 決めた間隔で、エージェントが自分から調べものや提案をします。
- **記憶**: エージェントごとの作業フォルダにある `MEMORY.md` に、次回以降のためのメモを残します。

## 必要なもの

配布版にはランナー用の Node.js が入っています。使うバックエンドに合わせて準備してください。

- Claude: [Claude Code](https://code.claude.com/docs/ja/quickstart)。macOS では「設定 → バックエンド → Claude」でセットアップし、必要なら Claude Code が開くブラウザーでログインできます。
- Codex: [Codex CLI](https://learn.chatgpt.com/docs/codex/cli#install-codex)。macOS では「設定 → バックエンド → Codex」でセットアップし、必要ならブラウザーで ChatGPT にログインできます。ほかの OS では同じ画面で手順を開けます。
- **Ollama**。「エージェントを追加」で **Ollama（この PC）** を選ぶと、Gemma や DeepSeek など、インストール済みの会話モデルを選べます。Mac で停止中なら **Ollama を起動** を押すとモデル一覧が自動で更新されます。画像対応のモデルには添付画像も渡せます。モデルを追加した直後は「設定 → バックエンド → すべて再確認」で一覧を更新できます。[Ollama](https://ollama.com/)

Claude と Codex の利用料は、それぞれのサービスのアカウントに対して発生します。

## 動かす

インストーラー（Windows x64・macOS Apple Silicon）は [GitHub のリリース](https://github.com/tobyapi/agent-guild/releases) から無料でダウンロードできます（最初のリリースは準備中です）。ソースからビルドして動かすこともできます。

ビルドには Node.js 24、[Rust](https://www.rust-lang.org/)（1.89 以降）、[Tauri の前提ソフト](https://tauri.app/start/prerequisites/)（Windows なら WebView2 と Visual Studio Build Tools、macOS なら Xcode Command Line Tools）が要ります。

```bash
npm install
npm run app
```

初めて起動すると、あなたの名前・スキルのフォルダ・データの保存先を決めるダイアログが出ます（どれもあとから設定で変えられます）。ロビーには作業者の「ミナト」が1人います。「設定 → バックエンド」で Codex を準備すると、話しかけられます。

### コマンド

| コマンド | 内容 |
|---|---|
| `npm run app` | アプリを開発モードで起動する |
| `npm run dev` | 画面だけをブラウザで起動する（バックエンドはモック。`?mockSetup=1` で初回設定、`?mockDemo=1` でサンプル会話、`?mockBoot=missing` で復旧画面を表示） |
| `npm run bundle` | 配布用のアプリとインストーラーを作る |
| `npm run format` | コードを整形する（TS・CSS は Prettier、Rust は cargo fmt） |
| `npm run check` | 整形の確認・型チェック・lint・保守性の検査・テスト・clippy・Rust のテストをまとめて実行する |

GitHub Actions（[.github/workflows/build.yml](.github/workflows/build.yml)）で、Windows（x64）と macOS（Apple Silicon）のインストーラーを作れます（手動実行か `v*` のタグの push で動きます）。タグのビルドでは、自動アップデート用の署名と `latest.json` も作り、下書きのリリースに添付します。リリースを公開すると、配布済みのアプリが新しい版を見つけます（仕組みと手順は [docs/design.md](docs/design.md) の「アプリの更新」）。`npm run check` は、main への push とプルリクエストのたびに GitHub Actions（[.github/workflows/check.yml](.github/workflows/check.yml)）でも走ります。

ローカルでは変更に関係するテスト・型チェック・lint だけを選びます。文書だけの変更は差分の確認で十分です。全チェックは CI を基本とし、広範囲の変更など必要なときに実行します。詳しくは [CLAUDE.md](CLAUDE.md) の「ローカルでの検証」を参照してください。

## 安全について

エージェントは、あなたの PC の上で、あなたと同じ権限で動きます。許可する権限は、任せる仕事に必要な分だけにしてください。

- 権限は、バックエンドごとに確実に守れる形で実装しています（守れない組み合わせは保存できません）。
- 「コマンドを実行」「作業フォルダの外にも書く」は、ファイルの削除や外部への送信もできてしまう強い権限です。編集画面で注意を出します。
- Web ページやファイルに紛れた指示（プロンプトインジェクション）への備えとして、エージェントに資料の扱い方を伝え、ファイルを読んで外へ送れてしまう権限の組み合わせには警告を出します。秘密らしい名前の環境変数はコマンドに渡しません。Claude のエージェントは、コマンドの実行や Web ページを開く前に、小さいモデルで依頼に沿っているかを確かめ、怪しければ止めます。
- これらは被害を減らすための仕組みで、完全に防げるものではありません。大事なデータや秘密を扱うときは、権限を絞ったエージェントを使ってください。

## データの保存先

チャンネル・エージェント・会話・作業フォルダは、データフォルダ（既定ではアプリのデータの場所。設定で変えられます）に保存します。マシンごとの設定（データフォルダの場所・スキルのフォルダ）は、OS のアプリの設定の場所にある `settings.json` に保存します。

## 開発者向け

- 仕様・IPC の契約・実行のしかた・データフォルダ: [docs/design.md](docs/design.md)
- コードの構造と拡張のしかた: [docs/architecture.md](docs/architecture.md)
- 見た目の指針: [docs/ui-design.md](docs/ui-design.md)
- 開発の方針と保守性の検査: [CLAUDE.md](CLAUDE.md)

構成は、React（画面）・Rust / Tauri（アプリの本体）・agent-runner（各バックエンドでエージェントを動かす Node のプロセス）の3つです。

## Code signing policy

Windows のインストーラーへのコード署名は、[SignPath Foundation](https://signpath.org/) の無料のプログラムに申請中です。承認されるまでは署名していません。何に、どう署名するか、担当者、プライバシーの方針は [Code signing policy](CODE_SIGNING_POLICY.md) にまとめています（英語）。設定と手順は [docs/code-signing.md](docs/code-signing.md)。

## プライバシー（Privacy policy）

このアプリは、利用者が求めたとき以外、情報をほかのネットワーク上のシステムへ送りません。例外は次のとおりです（英語の全文は [Code signing policy](CODE_SIGNING_POLICY.md#privacy-policy)）。

- **更新の確認**: 起動時とその後6時間ごとに、GitHub のリリース（`https://github.com/tobyapi/agent-guild/releases/latest/download/latest.json`）から新しい版があるかを確かめます。送るのは通常の HTTPS のリクエストだけで、会話やファイルの中身は送りません。「設定 → アプリの更新」の「新しい版を自動で確認する」をオフにすると、［更新を確認］を押したときだけ確かめます。
- **AI のバックエンド**: エージェントに話しかけると、そのエージェントに設定したバックエンド（Claude Code・Codex CLI・Ollama など）に会話を渡します。送り先とデータの扱いは、それぞれのサービスのプライバシーポリシーに従います。Ollama（この PC）は端末の外に送りません。
- **キャラ図鑑**: 図鑑の選択画面を開いたときだけ、画像を図鑑のサイトから取得します。

## ライセンス

ソフトウェアは [MIT](LICENSE) です。参加するときは [行動規範（Code of Conduct）](CODE_OF_CONDUCT.md) を守ってください。Windows 版には、コマンドを隔離して動かすための Microsoft の実行ファイル（[MXC](https://github.com/microsoft/mxc) の `wxc-exec.exe`、MIT）を同梱しています。

## 謝辞

エージェントの「キャラ図鑑」は Gender Swap AI のキャラクター図鑑を参照しています。キャラクターイラストを公開している ZipZipPipe さんと、DeepSeek の原キャラクターを制作した上善无形さんに感謝します。[AI 擬人化キャラクター図鑑](https://genderswapai.com/ja/ai-gijinka) · [ZipZipPipe](https://space.bilibili.com/4168597/dynamic)

図鑑の画像は選択画面を開いたときに取得し、選んだ画像の顔を正方形に切り抜いて端末に保存します。画像の作者・出典・利用条件は図鑑の各作品に記載されています。[DeepSeek の出典](https://genderswapai.com/ja/ai-gijinka/deepseek) · [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ja)
