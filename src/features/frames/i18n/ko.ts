import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const ko: Messages<typeof ja> = {
  label: '아이콘 테두리',
  none: '없음',
  oak: '떡갈나무 액자',
  harbor: '항구의 밧줄',
  clockwork: '시계공의 작업대',
  teatime: '한밤의 다과회',
  moth: '나방과 등불',
  raven: '풍향계의 까마귀',
  masquerade: '가면무도회',
  astrolabe: '별점술사의 천구의',
  generate: '생성…',
  remove: '“{name}” 삭제',
  removeTitle: '이 테두리를 삭제할까요?',
  removeMessage: '“{name}”을(를) 삭제합니다. 이 테두리를 쓰는 멤버는 테두리 없음으로 돌아갑니다.',
  removeConfirm: '삭제',
  dialogTitle: '아이콘 테두리 생성',
  dialogDescription:
    'AI에게 주제를 알려 주면 회화풍의 오리지널 테두리를 이미지로 그려 줍니다. 배경과 가운데 구멍은 투명하게 만든 뒤 저장합니다.',
  description: '주제',
  descriptionPlaceholder: '달밤의 장미와 사슬',
  descriptionHint: '분위기·모티프·색을 짧게 적어 주십시오(최대 200자)',
  descriptionEmpty: '원하는 테두리를 설명해 주십시오',
  descriptionTooLong: '주제는 200자 이내로 입력하십시오',
  name: '이름',
  nameHint: '비워 두면 주제로 이름을 붙입니다',
  backendHint: '“{backend}”에 로그인한 계정으로 이미지를 생성합니다(계정이나 요금제에 따라 사용할 수 없습니다)',
  noReadyBackends:
    '테두리를 생성할 수 있는 백엔드를 지금 사용할 수 없습니다. 설정의 “백엔드”에서 연결이나 로그인을 확인하십시오.',
  generating: '그리는 중…(몇 분 걸릴 수 있습니다. “중지”로 취소할 수 있습니다)',
  cancel: '취소',
  stop: '중지',
  submit: '생성',
  generated: '테두리 “{name}”을(를) 만들었습니다',
};
