import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const ko: Messages<typeof ja> = {
  statusReady: '준비됨',
  statusNeedsAuth: '로그인 필요',
  statusStopped: '중지됨',
  statusUnavailable: '사용할 수 없음',
  startingModels: '{backend}의 시작과 모델 목록 불러오기를 기다리고 있습니다.',
  starting: '시작하는 중…',
  start: '{backend} 시작',
  loggingIn: '로그인하는 중…',
  checking: '확인하는 중…',
  recheck: '다시 확인',
  unknownBackend: '이 환경에서는 찾을 수 없는 백엔드입니다',
  runtimeStarting: '에이전트 실행 환경을 시작하고 있습니다…',
  runtimeUnavailable: '에이전트를 실행할 수 없습니다',
  restart: '다시 시작',
  runtimeReady: '실행 환경이 준비되었습니다',
  recheckDone: '백엔드 다시 확인이 완료되었습니다. 각 백엔드의 상태를 확인하십시오.',
};
