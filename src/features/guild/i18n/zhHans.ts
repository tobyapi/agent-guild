import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHans: Messages<typeof ja> = {
  sectionTitle: '公会',
  defaultName: 'AI 公会',
  name: '公会名称',
  nameHint: '留空时显示“{name}”',
  nameTooLong: '公会名称不能超过 {max} 个字符',
  shape: '徽记形状',
  color: '徽记颜色',
  shapeDiamond: '菱形',
  shapeShield: '盾形',
  shapeCircle: '圆形',
  shapeHexagon: '六边形',
  shapeStar: '星形',
  colorDefault: '标准',
  colorGold: '金',
  colorCrimson: '绯红',
  colorJade: '翠绿',
  colorAzure: '天蓝',
  colorViolet: '紫藤',
  saving: '正在保存…',
  save: '保存',
  saved: '已保存',
};
