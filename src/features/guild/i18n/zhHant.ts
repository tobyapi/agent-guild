import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHant: Messages<typeof ja> = {
  sectionTitle: '公會',
  defaultName: 'AI 公會',
  name: '公會名稱',
  nameHint: '留空時顯示「{name}」',
  nameTooLong: '公會名稱不能超過 {max} 個字元',
  shape: '徽記形狀',
  color: '徽記顏色',
  shapeDiamond: '菱形',
  shapeShield: '盾形',
  shapeCircle: '圓形',
  shapeHexagon: '六邊形',
  shapeStar: '星形',
  colorDefault: '標準',
  colorGold: '金',
  colorCrimson: '緋紅',
  colorJade: '翠綠',
  colorAzure: '天藍',
  colorViolet: '紫藤',
  saving: '儲存中…',
  save: '儲存',
  saved: '已儲存',
};
