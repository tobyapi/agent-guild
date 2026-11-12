import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHans: Messages<typeof ja> = {
  retry: '重试',
  choose: '选择其他文件夹',
  useDefault: '恢复为默认位置',
  atDefault: '当前位置就是默认位置',
  kicker: '无法打开数据文件夹',
  location: '位置',
  openFolder: '打开文件夹',
  note: '即使恢复为默认位置，当前文件夹中的数据也不会被删除。',
  details: '详细信息',
  restarting: '正在重启…',
  fallbackTitle: '无法打开数据文件夹',
  missingTitle: '找不到数据文件夹',
  missingDescription: '无法访问设置的位置。如果位于外接驱动器或网络位置，请连接后重试。',
  lockedTitle: 'AI 公会已在运行',
  lockedDescription: '另一个使用同一数据文件夹的 AI 公会正在运行。请将其关闭后重试。',
  newerTitle: '这是新版本的数据',
  newerDescription: '此文件夹由更新版本的 AI 公会保存。为保护数据，此版本不会打开它。请更新应用，或选择其他文件夹。',
  foreignTitle: '不是 AI 公会的数据文件夹',
  foreignDescription: '此文件夹中有非 AI 公会的文件。为保护重要文件，不会使用此文件夹。',
  corruptTitle: '无法读取数据',
  corruptDescription: '数据库可能已损坏。原文件未做任何改动。',
  notWritableTitle: '无法写入此文件夹',
  notWritableDescription: '没有写入权限。请检查文件夹的权限，或选择其他文件夹。',
};
