import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const ko: Messages<typeof ja> = {
  cancel: '취소',
  close: '닫기',
  optional: '선택',
  add: '추가',
  notifications: '알림',
  dismissNotification: '알림 닫기',
  colorLabel: '개인 색상',
  avatarLabel: '아바타',
  avatarHint: '이모지를 하나 입력하거나, 이미지를 선택해 잘라낼 수 있습니다({size}px로 저장합니다).',
  avatarImagePlaceholder: '이미지',
  chooseImage: '이미지 선택',
  removeImage: '이미지 제거',
  cropTitle: '아바타 영역 선택',
  cropConfirm: '이 영역 사용',
  cropLoading: '이미지를 불러오는 중…',
  cropPreview: '미리 보기',
  cropZoom: '확대',
  cropZoomValue: '{zoom}배',
  cropReset: '원래대로',
  cropHelp: '드래그하거나 방향키(Shift를 누르면 크게)로 이동하고, 슬라이더·휠·+ / −로 확대합니다.',
  cropArea: '잘라낼 영역',
};
