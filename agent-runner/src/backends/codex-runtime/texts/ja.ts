// Codex と、Codex の実行の仕組みを使うバックエンド（Grok・Muse Spark）の、画面に出る文字列。日本語の表が正（キーの一覧）。
export const ja = {
  notFound: 'Codex のセットアップが必要です。AIギルドの「設定 → バックエンド → Codex」から進めてください。',
  needsLogin: 'Codex を使うには、ChatGPT アカウントでログインしてください。',
  needsLoginTerminal: 'ターミナルで `codex login` を実行するか、環境変数 OPENAI_API_KEY を設定してください。',
  loginLabel: 'ChatGPT でログイン',
  loginWaiting: 'ブラウザーで ChatGPT にログインしてください。',
  loginFailed: 'ChatGPT にログインできませんでした。ブラウザーを確認して、もう一度お試しください。',
  runFailed: 'Codex の実行に失敗しました（{detail}）',
  longPath:
    'Windows ではパスが 260 文字を超えると Codex CLI を起動できません。プロジェクトを短いパスに置いてください。',
  systemPromptTooLong: 'Codex に渡すシステムプロンプトは {max} 文字までです',
  folderNeedsSandbox:
    'フォルダ制限には OS の隔離が必要です（このバックエンドでは、隔離が使える Windows 11 で使えます）',
  ruleWrite:
    '書き込みを許すと、作業場所の中でのコマンド（プログラム）の実行を止められません。runCommands も許可してください',
  ruleWriteAnywhere:
    '作業場所の外への書き込みは sandbox を外して行うので、ネットワークアクセスも止められません。writeFiles と webFetch も許可してください',
  cannotStopReads: 'ファイルの読み取りを止められません（Codex はシェルで読み取ります）',
  cannotStopSkills: '利用者全体のスキルを含め、スキルの利用を止められません',
  experimental: '{name}（実験対応・実API未検証）',
  webSearch: 'Web検索',
  webAndXSearch: 'Web検索・X検索',
  providerModel: 'Codex SDK経由。{search}は未対応。API利用料が発生する。',
  providerReady: '実験対応・実API未検証。readyはAPIキーとCLIの存在確認のみで、接続成功を意味しない。',
  providerNeedsKey:
    '設定 → バックエンドでAPIキーを保存するか、環境変数 {envVar} を設定してアプリを再起動してください。{name}のWebログインは使えません。',
  providerFailed: '{name}の実行に失敗した。APIキー・利用枠・モデル名・接続を確認してください。',
  providerKeyRequired: '環境変数 {envVar} が必要です。',
  providerNoWebSearch: '{name}の{search}は未対応です。Web検索を無効にしてください。',
  providerEffort: '{name}の推論の深さは {choices} から選んでください。',
  providerModelOnly: '{name}では {model} を選択してください。',
};
