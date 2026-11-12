import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const ko: Messages<typeof ja> = {
  label: '아이콘',
  hint: '채널 목록과 머리글에서 # 대신 표시합니다. 이모지를 고르거나 하나 입력하십시오.',
  inputLabel: '아이콘 이모지',
  inputPlaceholder: '#',
  suggestions: '추천 아이콘',
  none: '없음(#)',
  choose: '{icon} 사용',
  invalid: '아이콘은 이모지 하나로 지정하십시오',
};
