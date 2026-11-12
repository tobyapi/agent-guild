import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const ko: Messages<typeof ja> = {
  retry: '다시 시도',
  choose: '다른 폴더 선택',
  useDefault: '기본 위치로 되돌리기',
  atDefault: '현재 위치가 기본 위치입니다',
  kicker: '데이터 폴더를 열 수 없습니다',
  location: '위치',
  openFolder: '폴더 열기',
  note: '기본 위치로 되돌려도 현재 폴더의 데이터는 지워지지 않습니다.',
  details: '자세한 정보',
  restarting: '다시 시작합니다…',
  fallbackTitle: '데이터 폴더를 열 수 없습니다',
  missingTitle: '데이터 폴더를 찾을 수 없습니다',
  missingDescription:
    '설정된 위치에 접근할 수 없습니다. 외장 드라이브나 네트워크 위치라면 연결한 뒤 다시 시도하십시오.',
  lockedTitle: 'AI 길드가 이미 실행 중입니다',
  lockedDescription: '같은 데이터 폴더를 사용하는 AI 길드가 하나 더 실행 중입니다. 그쪽을 닫은 뒤 다시 시도하십시오.',
  newerTitle: '새 버전의 데이터입니다',
  newerDescription:
    '이 폴더는 더 새로운 AI 길드에서 저장되었습니다. 데이터를 보호하기 위해 이 버전에서는 열지 않습니다. 앱을 업데이트하거나 다른 폴더를 선택하십시오.',
  foreignTitle: 'AI 길드의 데이터 폴더가 아닙니다',
  foreignDescription:
    '이 폴더에는 AI 길드 이외의 파일이 있습니다. 중요한 파일을 보호하기 위해 이 폴더는 사용하지 않습니다.',
  corruptTitle: '데이터를 불러올 수 없습니다',
  corruptDescription: '데이터베이스가 손상되었을 수 있습니다. 원래 파일은 변경하지 않았습니다.',
  notWritableTitle: '이 폴더에 쓸 수 없습니다',
  notWritableDescription: '쓰기 권한이 없습니다. 폴더 권한을 확인하거나 다른 폴더를 선택하십시오.',
};
