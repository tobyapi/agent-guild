import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHant: Messages<typeof ja> = {
  checkingSummary: '正在檢查新版本…',
  notChecked: '尚未檢查',
  upToDate: '目前版本 {current} 已是最新',
  available: '有新版本 {latest}（目前為 {current}）',
  notice: '有新版本 {version}',
  checking: '正在檢查…',
  check: '檢查更新',
  installHelp: '更新期間，正在工作的代理人會停止。對話和資料會保留。',
  installing: '正在更新…',
  install: '更新並重新啟動',
  autoCheck: '自動檢查新版本',
  autoCheckHelp: '啟動時及之後每 6 小時檢查一次 GitHub Releases。關閉後，只在點擊「檢查更新」時檢查。',
};
