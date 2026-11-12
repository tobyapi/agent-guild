import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHant: Messages<typeof ja> = {
  statusReady: '已就緒',
  statusNeedsAuth: '需要登入',
  statusStopped: '已停止',
  statusUnavailable: '無法使用',
  startingModels: '正在等待 {backend} 啟動並載入模型清單。',
  starting: '正在啟動…',
  start: '啟動 {backend}',
  loggingIn: '正在登入…',
  checking: '正在檢查…',
  recheck: '重新檢查',
  unknownBackend: '在此環境中找不到該後端',
  runtimeStarting: '正在啟動代理人的執行環境…',
  runtimeUnavailable: '無法執行代理人',
  restart: '重新啟動',
  runtimeReady: '執行環境已就緒',
  recheckDone: '後端重新檢查已完成。請查看各後端的狀態。',
};
