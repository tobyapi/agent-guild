import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const ko: Messages<typeof ja> = {
  checkingSummary: '새 버전을 확인하고 있습니다…',
  notChecked: '아직 확인하지 않았습니다',
  upToDate: '현재 버전 {current}은(는) 최신입니다',
  available: '새 버전 {latest}이(가) 있습니다(현재 {current})',
  notice: '새 버전 {version}이(가) 있습니다',
  checking: '확인하는 중…',
  check: '업데이트 확인',
  installHelp: '업데이트하는 동안 작업 중인 에이전트는 중지됩니다. 대화와 데이터는 그대로 남습니다.',
  installing: '업데이트하는 중…',
  install: '업데이트 후 다시 시작',
};
