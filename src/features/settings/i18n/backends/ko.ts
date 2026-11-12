import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const ko: Messages<typeof ja> = {
  checking: '확인하는 중…',
  recheckAll: '모두 다시 확인',
  waitingForRuntime: '에이전트 실행 환경이 시작되면 표시됩니다.',
  keySaved: '저장된 키를 사용하고 있습니다',
  keyEnvironment: '환경 변수의 키를 사용하고 있습니다',
  keyUnset: '키가 설정되지 않았습니다',
  keyChecking: '키 상태를 확인하고 있습니다',
  keyStatusLine: '{status}. 저장된 키를 우선 사용하고, 없으면 환경 변수 {envVar}를 사용합니다.',
  keyWindowsOnly: '키의 안전한 저장은 현재 Windows에서만 사용할 수 있습니다.',
  keyLabel: '{backend} API 키',
  keyHint: 'Windows 자격 증명 관리자에 저장합니다. 저장된 키는 표시하지 않습니다.',
  keyStoreUnavailable: '자격 증명 저장소를 확인할 수 없습니다. 실행 환경을 확인하고 설정을 다시 여십시오.',
  keySavedMessage: '저장했습니다. 다음 실행부터 사용합니다.',
  keyDeletedMessage: '저장된 키를 삭제했습니다. 환경 변수에 키가 있으면 그것을 사용합니다.',
  keyChangeFailed: '변경할 수 없습니다. 자격 증명 저장소와 실행 환경을 확인하고, 필요하면 다시 입력하십시오.',
  keyUpdate: '업데이트',
  keySave: '저장',
  keyDelete: '삭제',
  copied: '설치 명령을 복사했습니다.',
  copyFailed: '자동으로 복사할 수 없습니다. 명령 칸을 선택해서 복사하십시오.',
  settingUp: '설정하는 중…',
  retry: '다시 시도',
  setUp: '{backend} 설정',
  installing: '{cli}을(를) 다운로드하여 설치하고 있습니다. 몇 분 걸릴 수 있습니다.',
  installDone: '{backend} 설치가 완료되었습니다.',
  manualSummary: '{cli} 설치 방법',
  manualIntro:
    'macOS와 Linux에서는 Node.js나 Homebrew가 없어도 {publisher}의 공식 설치 프로그램으로 {cli}을(를) 설치할 수 있습니다.',
  commandLabel: '터미널에서 실행할 명령(macOS, Linux)',
  copyCommand: '명령 복사',
  officialSteps: '{publisher} 공식 설치 방법(Windows 포함)',
  afterInstall:
    '설치가 끝나면 이 화면에서 "다시 확인"을 누르십시오. 터미널에서 로그인하려면 새 터미널에서 {command}을(를) 실행하십시오.',
};
