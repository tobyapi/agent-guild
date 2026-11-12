import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const ko: Messages<typeof ja> = {
  noChannelTitle: '첫 번째 채널을 만들어 보십시오',
  createChannel: '채널 만들기',
  noChannelBody: '주제별로 채널을 나누면 에이전트가 문맥을 혼동하기 어려워집니다.',
  sidebar: '사이드바',
  appName: 'AI 길드',
  navigation: '채널과 에이전트',
  preparing: 'AI 길드를 준비하고 있습니다…',
  startFailed: '시작할 수 없습니다',
  retry: '다시 시도',
  viewUpdate: '내용 보기',
};
