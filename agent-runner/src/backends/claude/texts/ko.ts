import type { Messages } from '../../../i18n.ts';
import type { ja } from './ja.ts';

export const ko: Messages<typeof ja> = {
  notFound: 'Claude 설정이 필요합니다. AI 길드의 "설정 → 백엔드 → Claude"에서 진행하십시오.',
  loginAtRun: '로그인 상태는 실행할 때 확인합니다',
  needsLogin: 'Claude를 사용하려면 브라우저에서 Claude 계정에 로그인하십시오.',
  needsLoginTerminal:
    'Claude에 로그인하지 않았습니다. 터미널에서 `claude auth login`을 실행하거나 환경 변수 ANTHROPIC_API_KEY를 설정하십시오.',
  loginFailed: 'Claude에 로그인할 수 없습니다. 브라우저를 확인하고 다시 시도하십시오.',
  loginWindowFailed: '로그인 창을 열 수 없습니다({reason})',
  loginIncomplete: 'Claude 로그인이 완료되지 않았습니다. 열린 창과 브라우저에서 로그인을 끝까지 진행하십시오',
  loginLabel: 'Claude Code로 로그인',
  loginWaiting: '열린 창과 브라우저에서 로그인을 진행하십시오. 끝나면 상태가 자동으로 바뀝니다.',
  maxTurnsLabel: '최대 턴 수',
  maxTurnsDescription: '한 번의 답변에서 도구를 사용해 주고받을 수 있는 횟수의 상한',
  operationCheckLabel: '작업 확인',
  operationCheckDescription:
    '명령 실행, 웹 페이지 열기, 작업 폴더 밖에 쓰기 전에 작은 모델(Haiku)로 요청에 맞는지 확인하고, 의심스러우면 중지합니다(사람에게 묻지 않습니다)',
  folderUnsupported: 'Claude의 파일 작업은 점검 후 링크 교체를 제한할 수 없으므로 지정 폴더에서 실행할 수 없습니다',
  runFailed: 'Claude를 실행할 수 없습니다({detail})',
  hintAuth:
    'Claude 인증에 실패했습니다. 터미널에서 `claude`를 실행해 로그인하거나 환경 변수 ANTHROPIC_API_KEY를 설정하십시오.',
  hintRateLimit:
    'Claude 사용 한도, 속도 제한 또는 혼잡으로 실행할 수 없습니다. 잠시 기다린 후 다시 메시지를 보내십시오.',
  hintModelNotFound: '지정한 모델을 찾을 수 없습니다. 에이전트 설정의 모델 이름을 확인하십시오.',
  hintDetail: '{hint}({detail})',
  failed: 'Claude에서 오류가 발생했습니다({detail})',
  interrupted: 'Claude 실행이 도중에 끝났습니다({detail})',
  imageType: '지원하지 않는 이미지 형식입니다: {type}',
  imageRead: '첨부 이미지를 읽을 수 없습니다({path})',
  ruleWrite: '작업 공간 밖에 쓰기를 허용하려면 파일 쓰기도 허용하십시오',
  ruleBash: '명령 실행을 허용하면 작업 공간 밖을 포함한 파일 읽기/쓰기와 네트워크 접근을 막을 수 없습니다',
};
