import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHans: Messages<typeof ja> = {
  statusReady: '已就绪',
  statusNeedsAuth: '需要登录',
  statusStopped: '已停止',
  statusUnavailable: '不可用',
  startingModels: '正在等待 {backend} 启动并加载模型列表。',
  starting: '正在启动…',
  start: '启动 {backend}',
  loggingIn: '正在登录…',
  checking: '正在检查…',
  recheck: '重新检查',
  unknownBackend: '在此环境中找不到该后端',
  runtimeStarting: '正在启动智能体的运行环境…',
  runtimeUnavailable: '无法运行智能体',
  restart: '重启',
  runtimeReady: '运行环境已就绪',
  recheckDone: '后端重新检查已完成。请查看各后端的状态。',
};
