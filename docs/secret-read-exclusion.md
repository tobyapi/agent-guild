# readAnywhere の秘密情報の除外（B）

この変更は Claude の readAnywhere が追加した読み取りに適用する。writeAnywhere の作業者、readAnywhere のない発想役、書き込み判定、Codex の設定は変更しない。作業場所・readableDirs の中に実体も収まる読み取りは従来どおり許可する。ただし readAnywhere あり・writeAnywhere なしの場合、Glob の絶対パス pattern は起点に関係なく拒否する。絶対 pattern は path を無視して範囲外を一覧できるためで、作業場所内の検索は path と相対 pattern で指定する。その範囲にある .env 等の Read は今回の除外対象ではない。外へ出るシンボリックリンクは拡張範囲として判定する。

## 除外リストと理由

以下の ~ はランナーを実行するユーザーのホーム。実際のファイルの内容を調査して列挙したリストではない。

| 対象 | 理由 |
|---|---|
| ~/.ssh、~/.gnupg、~/.aws、~/.azure、~/.kube、~/.docker、~/.config/gcloud、~/.config/gh | 秘密鍵、クラウド・CLI の認証情報 |
| ~/.netrc、~/.npmrc、~/.pypirc、~/.git-credentials | 認証情報を含みうる設定 |
| ~/.codex/auth.json、config.toml。CODEX_HOME の同名ファイル | 認証情報と、トークンを含みうる設定。通常位置と環境変数による移動先の両方を対象にする |
| ~/.claude/.credentials.json、settings.json、settings.local.json。CLAUDE_CONFIG_DIR の同名ファイル。~/.claude.json | Claude 認証と、環境変数などの秘密を含みうる設定。スキル等を使えるように .codex/.claude 全体は除外しない |
| ~/Library/Keychains、Cookies、Mail、Messages、Safari、Accounts | 認証情報、ブラウザのデータ、メール、メッセージ。Accounts はアカウント情報の保存先として追加 |
| ~/Library/Containers/com.apple.Safari、com.apple.mail、com.apple.MobileSMS | サンドボックス版アプリの関連データ |
| ~/Library/Group Containers/group.com.apple.notes、group.com.apple.mail、group.com.apple.messages、group.com.apple.Safari | アプリ間で共有する個人データ。Notes は秘密のメモを含みうるため追加 |
| ~/Library/Application Support/ の Google/Chrome、Chromium、Microsoft Edge、BraveSoftware、Firefox、Arc、Vivaldi、Opera、com.operasoftware.Opera、Zen、Dia | 既知のブラウザのプロファイル。個々のファイルを選ぶ方式による取りこぼしを減らすためディレクトリ単位で除外 |
| ~/Library/Application Support/com.apple.TCC | OS の権限管理データとして追加 |
| ~/Library/Application Support/com.agentguild.app/settings.json、settings.json.tmp | アプリの設定。未知フィールドも保持する形式のため全体を除外。一時保存も同じ扱い |
| ~/Library/WebKit/com.agentguild.app、HTTPStorages/com.agentguild.app、Caches/com.agentguild.app | アプリのWebViewデータ・Cookie等を含みうる保存先 |
| 場所を問わず .env、.env.*、*.pem、*.key、*.p12、*.pfx、id_rsa*、id_dsa*、id_ecdsa*、id_ed25519* | 環境変数と鍵。pfx と DSA/ECDSA も鍵の形式・名前として追加。ファイルだけでなくパスの各要素に適用する |
| 場所を問わず guild.db、guild.db-*、guild.db.* | 全チャンネルの会話。WAL・SHMに加えバックアップ・エクスポート一時ファイルも対象。データ保存先を移しても同じ名前を拒否する |

指定の対象から除いたものはない。ブラウザ等の独自の保存先を自動的に発見する機能はない。エージェントの作業フォルダを含むアプリのデータフォルダ全体は除外しない。

レビュー後に `com.operasoftware.Opera` を追加した。macOS のこの保存先は [Opera公式記事](https://blogs.opera.com/desktop/2023/08/resolving-profile-loss-issues-in-opera-version-102-0-4880-16/) の例で確認した。既存の `Opera` は削除せず維持する。

## アプリのデータ・認証の保存方法（コードで確認）

- `src-tauri/src/bootstrap/paths.rs`: データ保存先は GUILD_DATA_DIR、app_config_dir/settings.json の dataDir、既定 app_local_data_dir/data の順。macOS のアプリ識別子は `com.agentguild.app`（tauri.conf.json）。
- `src-tauri/src/infrastructure/data_dir.rs`: データ保存先の guild.db、agents/<id>/{work,state}、attachments/<channelId> という構成。DB の実データは今回開いていない。
- `src-tauri/src/infrastructure/settings.rs`: 起動設定は app_config_dir/settings.json。一時保存は settings.json.tmp。データ保存先やスキルライブラリ等を保持し、未知フィールドも維持する。
- `agent-runner/src/credentials/store.ts` と `windows-script.ts`: アプリ独自の Grok/Muse API キー保存機能は Windows 資格情報ストア（AI-Guild/backend-api-key/<backend>）。macOS では保存操作は unsupported、環境変数を使用する。平文ファイルへの代替保存はない。
- `backends/claude/probe.ts` と `login.ts`: macOS は Claude CLI に認証状態を問い合わせ、Keychain を使う経路がある。他環境の .credentials.json、環境変数による認証もある。
- `backends/codex/probe.ts` と `codex-runtime/models.ts`: CODEX_HOME または ~/.codex。認証ファイルの既知名は auth.json。

認証情報の値、Keychain、設定ファイルの中身は閲覧していない。モデルのファイルツールへの拒否であり、CLI 自身が認証に必要な情報を読む処理は止めない。

## 読み取り・検索の判定

`permissions.ts` の fileAccessPolicy が共通の入口。check.ts の checkedPolicy もこれを使うため、操作確認の有効・無効で除外は変わらない。

入力パスと realpath で解決した実体の両方を判定する。非存在の末尾は既存の親まで解決し、壊れたリンク・循環・解決失敗は拒否する。除外先自体がリンクの場合の実体も対象。macOS と Windows では除外比較を大小文字を区別せずに行い、Unicode は NFC にそろえる。実体の解決結果は1回の実行のポリシー内で保持する。

Grep・Glob・LS は、除外先の中、および除外先を含む起点を拒否する。ホームや Library を起点にした検索も該当する。その後、配下のディレクトリ名・エントリのメタデータを点検する。秘密ファイルの内容は開かない。.env等が1つでもあれば検索自体を拒否し、SDK に渡す入力の glob による除外には頼らない。既存の除外設定や隠しファイルの扱いにも依存しない。

検索配下のリンクは安全な行き先でも拒否する。点検は起点を含め10,000エントリ、深さ64までとし、上限超過・アクセス不可・特殊ファイルは拒否する。node_modules のリンク、件数上限、.env.example のいずれかがあればリポジトリ直下の検索も拒否される。Glob の絶対パス pattern は、writeAnywhere のないすべての Claude の役割で、元の作業範囲を許可する前に拒否する。readAnywhere の有無には依存しない。外部 Glob はさらに ..、バックスラッシュ、波括弧、~ を拒否する。

拒否時は、除外対象、子リンク、件数上限、深さ上限、特殊項目、解決・点検不能などの理由と、狭い起点または公開ファイルの個別 Read を案内する。事前点検で見つけた子の名前・パスは返さない。拒否メッセージには従来どおり呼び出し元が指定した起点が入る。

## 残る制約

- Codex は今回対象外。既存の workspace-write sandbox は読み取りを絞らず、同じ役割名でもこの除外は効かない。
- 作業者の writeAnywhere は維持する。発想役等の writeAnywhere のない役割では、従来通っていた絶対 Glob pattern を拒否する。元から読める作業場所・readableDirs 内の秘密名も維持する。これは PC 全体の秘密情報をすべての役割から隔離する仕組みではない。
- パスの事前判定なので、判定後・検索点検後に別プロセスがファイルやリンクを差し替える競合（TOCTOU）を OS の境界として止められない。除外先の実体の変更もポリシー再作成までは追従しない。ハードリンク、別名コピー、別マウントによる別経路は内容の由来を判別できない。
- 一覧外のブラウザ・独自プロファイル、別名の認証ファイル、認証設定のバックアップ等を網羅する保証はない。
- Chrome Beta/Canary の標準プロファイルと、~/.zsh_history・.zsh_history.new・.bash_history・.zsh_sessions・.bash_sessions は追加済み。履歴の任意の移動先（HISTFILE・ZDOTDIR）や別名のバックアップ、1Password、Slack、iCloud 等は未追加。Windows・Linux 用のブラウザとアプリ設定の保存先の一覧もない。共通の ~/.xxx と秘密名の規則はあるが、他OSを網羅する除外ではない。
- アプリの attachments/<channelId> と agents/*/state は場所で除外していない。会話・添付を含む可能性があり、今回の追加可否は未決。MEMORY.md 等の共有とも合わせて A で分離が必要。
- Grep 等に複数のパス項目を渡した場合の SDK による検証は未確認（レビュー R5）。道具別の入力制限は今回追加していない。
- エージェント間の作業フォルダとメモは共有状態のまま。会話本文や、マネージャーからWebを使える作業者への依頼文を通じた持ち出しも残る。
- canUseTool の経路のテストであり、SDK/CLI による暗黙の読み取りを OS レベルで拒否する検証ではない。実モデルを使った有料の通し実行、Windows実機検証は未実施。

## 2026-11-11 全役割の Glob 修正と除外追加

絶対 pattern の拒否理由は path に起点、pattern に相対パターンを書く案内だけを返し、狭い検索範囲への一般案内は付けない。writeAnywhere のある Claude、Codex、Ollama の処理は変更しない。作業者の既定は writeAnywhere=true なので維持される。writeAnywhere を外した作業者の構成も、発想役と同じ拒否判定を通る。

追加場所の根拠（履歴の内容は閲覧していない）:
- Chrome Beta/Canary: [Chromium公式 user_data_dir.md](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/user_data_dir.md) の Mac OS X。~/Library/Application Support/Google/Chrome Beta と Chrome Canary。独自 --user-data-dir の移動先は網羅しない。
- zsh: このmacOSの /etc/zshrc:15-18 で HISTFILE=${ZDOTDIR:-$HOME}/.zsh_history。今回の既知標準位置はホーム直下。書換え時の .new は [zsh公式 HIST_SAVE_BY_COPY](https://zsh.sourceforge.io/Doc/Release/Options.html#History)。
- Bash: このmacOSの /bin/bash --noprofile --norc -ic で設定だけを確認した標準 HISTFILE（値はホーム直下 .bash_history）。表示したのは HISTFILE の保存先だけで、履歴本文は表示・収集していない。対話シェル自身の起動時読み込みはこの確認から除外できない。
- Terminal のセッション履歴: /etc/zshrc_Apple_Terminal:102,190-192 と /etc/bashrc_Apple_Terminal:99,187-189。.zsh_sessions と .bash_sessions 全体を除外する（履歴のほかセッション復元用の状態も入りうるため）。
- 他のシェル、履歴の独自保存先、Chrome Dev/Testing は今回の依頼対象に足していない。
