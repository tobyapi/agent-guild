import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const ko: Messages<typeof ja> = {
  loading: '불러오는 중…',
  currentLocation: '현재 위치',
  newLocation: '새 위치',
  openFolder: '폴더 열기',
  change: '변경…',
  sameFolder: '현재 저장 위치와 같은 폴더입니다',
  sourceDefault: '기본 위치입니다.',
  sourceSettings: '설정에서 변경한 위치입니다(기본: {dir}).',
  sourceEnv: '환경 변수 GUILD_DATA_DIR로 정해져 있으므로 여기에서는 변경할 수 없습니다.',
  modeCopyLabel: '현재 데이터를 복사해서 사용',
  modeCopyDescription: '채널, 에이전트, 대화를 빈 폴더에 복사해서 사용합니다. 원래 데이터는 지워지지 않습니다.',
  modeOpenLabel: '그 위치의 데이터 열기',
  modeOpenDescription: '그 폴더에 있는 길드 데이터로 시작합니다. 빈 폴더라면 새로 시작합니다.',
  changingCopy: '데이터를 복사하는 중…',
  changingOpen: '전환하는 중…',
  dialogTitle: '데이터 저장 위치 변경',
  dialogDescription: '변경하면 AI 길드를 다시 시작하고 새 위치의 데이터로 다시 엽니다.',
  dialogLegend: '현재 데이터를 어떻게 하시겠습니까?',
  cancel: '취소',
  changeAndRestart: '변경 후 다시 시작',
  changedRestarting: '저장 위치를 변경했습니다. 앱을 다시 시작합니다…',
};
