import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHans: Messages<typeof ja> = {
  checkingSummary: '正在检查新版本…',
  notChecked: '尚未检查',
  upToDate: '当前版本 {current} 已是最新',
  available: '有新版本 {latest}（当前为 {current}）',
  notice: '有新版本 {version}',
  checking: '正在检查…',
  check: '检查更新',
  installHelp: '更新期间，正在工作的智能体会停止。对话和数据会保留。',
  installing: '正在更新…',
  install: '更新并重启',
};
