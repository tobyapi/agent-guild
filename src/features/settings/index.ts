// settings: 設定ダイアログ（プロフィール・言語・外観（テーマ・アクセントの色）・通知・バックエンド・データの保存先・アプリの更新）・初回起動の初期設定・テーマとアクセントの色の反映。
export { SettingsDialog } from './components/SettingsDialog';
export { SetupDialog } from './components/SetupDialog';
export { openSettings, openSetup } from './store';
export { initAccent } from './accentStore';
export { initTheme } from './themeStore';
