// Claude のアダプタが作る、画面に出る文字列（状態の説明・設定項目・ログイン・エラー）。日本語の表が正（キーの一覧）。
export const ja = {
  notFound: 'Claude のセットアップが必要です。AIギルドの「設定 → バックエンド → Claude」から進めてください。',
  loginAtRun: 'ログイン状態は実行時に確認します',
  needsLogin: 'Claude を使うには、ブラウザーで Claude のアカウントにログインしてください。',
  needsLoginTerminal:
    'Claude にログインしていません。ターミナルで `claude auth login` を実行するか、環境変数 ANTHROPIC_API_KEY を設定してください。',
  loginFailed: 'Claude にログインできませんでした。ブラウザーを確認して、もう一度お試しください。',
  loginWindowFailed: 'ログインの窓を開けませんでした（{reason}）',
  loginIncomplete: 'Claude のログインが完了しませんでした。開いた窓とブラウザで、ログインを最後まで進めてください',
  loginLabel: 'Claude Code でログイン',
  loginWaiting: '開いた窓とブラウザでログインを進めてください。終わると自動で状態が変わります。',
  maxTurnsLabel: '最大ターン数',
  maxTurnsDescription: '1回の返答でツールを使って往復できる回数の上限',
  operationCheckLabel: '操作の確認',
  operationCheckDescription:
    'コマンドの実行・Web ページを開く・作業フォルダの外への書き込みの前に、小さいモデル（Haiku）で依頼に沿っているかを確かめ、怪しければ止めます（人間には聞きません）',
  folderUnsupported: 'Claudeのファイル操作は点検後のリンク差し替えを制限できないため、指定フォルダでは実行できません',
  runFailed: 'Claude を実行できませんでした（{detail}）',
  hintAuth:
    'Claude の認証に失敗しました。ターミナルで `claude` を実行してログインするか、環境変数 ANTHROPIC_API_KEY を設定してください。',
  hintRateLimit:
    'Claude の利用上限・レート制限・混雑のため実行できませんでした。少し待ってから再度話しかけてください。',
  hintModelNotFound: '指定したモデルが見つかりません。エージェント設定のモデル名を確認してください。',
  hintDetail: '{hint}（{detail}）',
  failed: 'Claude でエラーが発生しました（{detail}）',
  interrupted: 'Claude の実行が途中で終わりました（{detail}）',
  imageType: '対応していない画像の形式です: {type}',
  imageRead: '添付画像を読めませんでした（{path}）',
  ruleWrite: '作業場所の外への書き込みを許すなら、ファイルの書き込みも許してください',
  ruleBash: 'コマンドの実行を許すと、作業場所の外も含めたファイルの読み書きやネットワークアクセスを止められません',
};
