import type { Messages } from '../../../i18n.ts';
import type { ja } from './ja.ts';

export const ko: Messages<typeof ja> = {
  notFound: 'Codex 설정이 필요합니다. AI 길드의 "설정 → 백엔드 → Codex"에서 진행하십시오.',
  needsLogin: 'Codex를 사용하려면 ChatGPT 계정으로 로그인하십시오.',
  needsLoginTerminal: '터미널에서 `codex login`을 실행하거나 환경 변수 OPENAI_API_KEY를 설정하십시오.',
  loginLabel: 'ChatGPT로 로그인',
  loginWaiting: '브라우저에서 ChatGPT에 로그인하십시오.',
  loginFailed: 'ChatGPT에 로그인할 수 없습니다. 브라우저를 확인하고 다시 시도하십시오.',
  runFailed: 'Codex 실행에 실패했습니다({detail})',
  longPath: 'Windows에서는 경로가 260자를 넘으면 Codex CLI를 시작할 수 없습니다. 프로젝트를 짧은 경로에 두십시오.',
  systemPromptTooLong: 'Codex에 전달하는 시스템 프롬프트는 {max}자까지입니다',
  folderNeedsSandbox:
    '폴더 제한에는 OS 격리가 필요합니다(이 백엔드는 격리를 쓸 수 있는 Windows 11에서 사용할 수 있습니다)',
  ruleWrite: '쓰기를 허용하면 작업 공간 안에서의 명령(프로그램) 실행을 막을 수 없습니다. runCommands도 허용하십시오',
  ruleWriteAnywhere:
    '작업 공간 밖에 쓰기는 sandbox를 해제하고 수행하므로 네트워크 접근도 막을 수 없습니다. writeFiles와 webFetch도 허용하십시오',
  cannotStopReads: '파일 읽기를 막을 수 없습니다(Codex는 셸로 읽습니다)',
  cannotStopSkills: '사용자 전체의 스킬을 포함해 스킬 사용을 막을 수 없습니다',
  experimental: '{name}(실험적 지원・실제 API 미검증)',
  webSearch: '웹 검색',
  webAndXSearch: '웹 검색・X 검색',
  providerModel: 'Codex SDK 경유. {search}은(는) 지원하지 않습니다. API 사용료가 발생합니다.',
  providerReady:
    '실험적 지원・실제 API 미검증. ready는 API 키와 CLI가 있는지만 확인한 것이며 연결 성공을 의미하지 않습니다.',
  providerNeedsKey:
    '설정 → 백엔드에서 API 키를 저장하거나 환경 변수 {envVar}를 설정하고 앱을 다시 시작하십시오. {name}은(는) 웹 로그인을 사용할 수 없습니다.',
  providerFailed: '{name} 실행에 실패했습니다. API 키, 사용 한도, 모델 이름, 연결을 확인하십시오.',
  providerKeyRequired: '환경 변수 {envVar}가 필요합니다.',
  providerNoWebSearch: '{name}은(는) {search}을(를) 지원하지 않습니다. 웹 검색을 끄십시오.',
  providerEffort: '{name}의 추론 깊이는 {choices} 중에서 선택하십시오.',
  providerModelOnly: '{name}에서는 {model}을(를) 선택하십시오.',
};
