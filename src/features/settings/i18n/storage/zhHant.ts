import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHant: Messages<typeof ja> = {
  loading: '載入中…',
  currentLocation: '目前位置',
  newLocation: '新位置',
  openFolder: '開啟資料夾',
  change: '變更…',
  sameFolder: '與目前的儲存位置是同一個資料夾',
  sourceDefault: '這是預設位置。',
  sourceSettings: '這是在設定中變更的位置（預設：{dir}）。',
  sourceEnv: '由環境變數 GUILD_DATA_DIR 決定，無法在此變更。',
  modeCopyLabel: '複製目前的資料並使用',
  modeCopyDescription: '將頻道、代理人和對話複製到空資料夾中使用。原本的資料不會被刪除。',
  modeOpenLabel: '開啟該位置的資料',
  modeOpenDescription: '使用該資料夾中的公會資料啟動。如果是空資料夾，則重新開始。',
  changingCopy: '正在複製資料…',
  changingOpen: '正在切換…',
  dialogTitle: '變更資料儲存位置',
  dialogDescription: '變更後，AI 公會將重新啟動，並使用新位置的資料重新開啟。',
  dialogLegend: '要如何處理目前的資料？',
  cancel: '取消',
  changeAndRestart: '變更並重新啟動',
  changedRestarting: '已變更儲存位置。正在重新啟動應用程式…',
};
