import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const ko: Messages<typeof ja> = {
  sectionTitle: '알림',
  messageSound: '답장 알림음',
  messageSoundHint: '에이전트의 메시지가 도착하면 재생합니다.',
  mentionSound: '나를 멘션한 알림음',
  mentionSoundHint: '나를 멘션한 메시지가 도착하면 재생합니다.',
  soundOff: '없음',
  soundChime: '차임',
  soundBell: '벨',
  soundPop: '퐁',
  soundWood: '나무',
  preview: '미리 듣기',
  previewLabel: '{sound} 미리 듣기',
  volume: '음량',
  onlyWhenUnfocused: '창을 보고 있지 않을 때만 재생',
  onlyWhenUnfocusedHint: '다른 앱을 사용하는 동안 도착한 메시지만 소리로 알립니다.',
};
