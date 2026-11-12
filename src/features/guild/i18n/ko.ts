import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const ko: Messages<typeof ja> = {
  sectionTitle: '길드',
  defaultName: 'AI 길드',
  name: '길드 이름',
  nameHint: '비워 두면 "{name}"(으)로 표시합니다',
  nameTooLong: '길드 이름은 {max}자 이내로 입력하십시오',
  shape: '문장 모양',
  color: '문장 색',
  shapeDiamond: '마름모',
  shapeShield: '방패',
  shapeCircle: '원',
  shapeHexagon: '육각형',
  shapeStar: '별',
  colorDefault: '기본',
  colorGold: '금색',
  colorCrimson: '진홍',
  colorJade: '비취',
  colorAzure: '하늘',
  colorViolet: '보라',
  saving: '저장 중…',
  save: '저장',
  saved: '저장했습니다',
};
