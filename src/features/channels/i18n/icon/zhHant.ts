import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHant: Messages<typeof ja> = {
  label: '圖示',
  hint: '在頻道列表和標題中代替 # 顯示。請選擇或輸入一個表情符號。',
  inputLabel: '圖示表情符號',
  inputPlaceholder: '#',
  suggestions: '推薦的圖示',
  none: '無（#）',
  choose: '使用 {icon}',
  invalid: '圖示請使用一個表情符號',
};
