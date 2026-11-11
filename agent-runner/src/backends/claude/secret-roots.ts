// 秘密情報がある既知の場所（readAnywhere で広げた読み取りから除く。理由は docs/secret-read-exclusion.md）。
// OS で分けずに全部を並べる（その OS にない場所は何にも当たらない）。中身を調べて作った一覧ではなく、網羅もしない。

import { homedir } from 'node:os';
import { join } from 'node:path';

/** アプリの識別子（tauri.conf.json の identifier。設定・WebView のデータ・ログのフォルダ名になる） */
const APP_ID = 'com.agentguild.app';

/** ホーム直下: 鍵・クラウドと CLI の認証・認証情報を含みうる設定・シェルなどの履歴 */
const HOME = [
  ...['.ssh', '.gnupg', '.aws', '.azure', '.kube', '.docker', '.oci', '.password-store', '.terraform.d'],
  ...['.netrc', '_netrc', '.npmrc', '.pypirc', '.git-credentials', '.pgpass', '.my.cnf', '.vault-token'],
  ...['.cargo/credentials', '.cargo/credentials.toml', '.gem/credentials', '.m2/settings.xml'],
  ...['.gradle/gradle.properties', '.terraformrc', '.claude.json'],
  ...['.zsh_history', '.zsh_history.new', '.bash_history', '.zsh_sessions', '.bash_sessions'],
  ...['.python_history', '.node_repl_history', '.psql_history', '.mysql_history', '.sqlite_history'],
  // Linux のブラウザ・メール・鍵束
  ...['.mozilla', '.thunderbird', 'snap/firefox', 'snap/chromium', '.local/share/keyrings'],
];

/** 設定のフォルダ（~/.config と XDG_CONFIG_HOME）: CLI の認証と、Linux のブラウザ・チャットのプロファイル */
const CONFIG = [
  ...['gcloud', 'gh', 'git/credentials', 'op', 'rclone', 'doctl', 'configstore'],
  ...['google-chrome', 'google-chrome-beta', 'google-chrome-unstable', 'chromium', 'microsoft-edge'],
  ...['BraveSoftware', 'vivaldi', 'opera', 'Slack', 'discord'],
  ...[`${APP_ID}/settings.json`, `${APP_ID}/settings.json.tmp`],
];

/** macOS の ~/Library */
const MAC_LIBRARY = [
  ...['Keychains', 'Cookies', 'Mail', 'Messages', 'Safari', 'Accounts'],
  ...['Containers/com.apple.Safari', 'Containers/com.apple.mail', 'Containers/com.apple.MobileSMS'],
  ...['notes', 'mail', 'messages', 'Safari'].map((name) => `Group Containers/group.com.apple.${name}`),
  ...[
    ...['Google/Chrome', 'Google/Chrome Beta', 'Google/Chrome Canary', 'Chromium', 'Microsoft Edge'],
    ...['BraveSoftware', 'Firefox', 'Arc', 'Vivaldi', 'Opera', 'com.operasoftware.Opera', 'Zen', 'Dia'],
    ...['com.apple.TCC', `${APP_ID}/settings.json`, `${APP_ID}/settings.json.tmp`],
  ].map((path) => `Application Support/${path}`),
  ...['WebKit', 'HTTPStorages', 'Caches', 'Logs'].map((dir) => `${dir}/${APP_ID}`),
];

/** Windows の %APPDATA%（Roaming）: OS の資格情報と鍵・履歴・ブラウザ・CLI の認証・チャットとメールのアプリ */
const WINDOWS_ROAMING = [
  ...['Credentials', 'Protect', 'Crypto', 'SystemCertificates', 'Vault'].map((dir) => `Microsoft/${dir}`),
  ...['Microsoft/Windows/PowerShell/PSReadLine', 'Microsoft/Teams'],
  ...['Mozilla/Firefox', 'Opera Software', 'zen', 'Thunderbird', 'gcloud', 'GitHub CLI'],
  ...['Slack', 'discord', 'Telegram Desktop', 'Signal', 'Claude', '1Password', 'Bitwarden'],
  ...[`${APP_ID}/settings.json`, `${APP_ID}/settings.json.tmp`],
];

/** Windows の %LOCALAPPDATA%: ブラウザのプロファイル・OS の資格情報と認証の控え・アプリの WebView のデータとログ */
const WINDOWS_LOCAL = [
  ...['Chrome', 'Chrome Beta', 'Chrome SxS'].map((name) => `Google/${name}/User Data`),
  ...['Edge', 'Edge Beta', 'Edge Dev', 'Edge SxS'].map((name) => `Microsoft/${name}/User Data`),
  ...['Chromium/User Data', 'Vivaldi/User Data', 'BraveSoftware', 'Mozilla/Firefox', 'Opera Software'],
  ...['Credentials', 'Vault', 'OneAuth', 'IdentityCache', 'TokenBroker'].map((dir) => `Microsoft/${dir}`),
  ...['INetCookies', 'WebCache', 'History'].map((dir) => `Microsoft/Windows/${dir}`),
  ...['1Password', `${APP_ID}/EBWebView`, `${APP_ID}/logs`],
];

/** Linux のデータとキャッシュ（~/.local/share・~/.cache と XDG_*）: アプリのログと WebView のキャッシュ */
const LINUX_APP = [`${APP_ID}/logs`];

/** 既定の場所と、環境変数で移した場所の両方を見る */
function bases(fallback: string, moved: string | undefined): string[] {
  return moved ? [fallback, moved] : [fallback];
}

function under(dirs: readonly string[], paths: readonly string[]): string[] {
  return dirs.flatMap((dir) => paths.map((path) => join(dir, path)));
}

/** 除外する場所の絶対パス。その下もすべて除外する */
export function secretRoots(env: NodeJS.ProcessEnv = process.env): string[] {
  const home = homedir();
  const appData = join(home, 'AppData');
  return [
    ...under([home], HOME),
    ...under(bases(join(home, '.config'), env.XDG_CONFIG_HOME), CONFIG),
    ...under(bases(join(home, '.codex'), env.CODEX_HOME), ['auth.json', 'config.toml']),
    ...under(bases(join(home, '.claude'), env.CLAUDE_CONFIG_DIR), [
      '.credentials.json',
      'settings.json',
      'settings.local.json',
    ]),
    ...under([join(home, 'Library')], MAC_LIBRARY),
    ...under(bases(join(appData, 'Roaming'), env.APPDATA), WINDOWS_ROAMING),
    ...under(bases(join(appData, 'Local'), env.LOCALAPPDATA), WINDOWS_LOCAL),
    ...under(bases(join(home, '.local', 'share'), env.XDG_DATA_HOME), LINUX_APP),
    ...under(bases(join(home, '.cache'), env.XDG_CACHE_HOME), [APP_ID]),
  ];
}
