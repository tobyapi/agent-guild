import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHans: Messages<typeof ja> = {
  loading: '加载中…',
  currentLocation: '当前位置',
  newLocation: '新位置',
  openFolder: '打开文件夹',
  change: '更改…',
  sameFolder: '与当前存储位置是同一个文件夹',
  sourceDefault: '这是默认位置。',
  sourceSettings: '这是在设置中更改的位置（默认：{dir}）。',
  sourceEnv: '由环境变量 GUILD_DATA_DIR 决定，无法在此更改。',
  modeCopyLabel: '复制当前数据并使用',
  modeCopyDescription: '将频道、智能体和对话复制到空文件夹中使用。原数据不会被删除。',
  modeOpenLabel: '打开该位置的数据',
  modeOpenDescription: '使用该文件夹中的公会数据启动。如果是空文件夹，则重新开始。',
  changingCopy: '正在复制数据…',
  changingOpen: '正在切换…',
  dialogTitle: '更改数据存储位置',
  dialogDescription: '更改后，AI 公会将重启，并使用新位置的数据重新打开。',
  dialogLegend: '如何处理当前数据？',
  cancel: '取消',
  changeAndRestart: '更改并重启',
  changedRestarting: '已更改存储位置。正在重启应用…',
};
