import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHans: Messages<typeof ja> = {
  label: '图标',
  hint: '在频道列表和标题中代替 # 显示。请选择或输入一个表情符号。',
  inputLabel: '图标表情符号',
  inputPlaceholder: '#',
  suggestions: '推荐的图标',
  none: '无（#）',
  choose: '使用 {icon}',
  invalid: '图标请使用一个表情符号',
};
