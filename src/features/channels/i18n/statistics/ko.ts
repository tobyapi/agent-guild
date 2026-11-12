import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const ko: Messages<typeof ja> = {
  title: '운영 통계',
  description: '# {name} · 전체 기간',
  refresh: '새로 고침',
  loading: '운영 통계를 불러오는 중…',
  loadFailed: '통계를 불러오지 못했습니다. {error}',
  delegation: '위임',
  delegationCount: '위임 건수',
  reportRate: '결과 보고율',
  failedSubtasks: '실패한 하위 작업',
  cancelledSubtasks: '중단된 하위 작업',
  count: '{count}건',
  ratio: '{done} / {total}건',
  delegationNote:
    '하위 작업 {subtasks}건(미결 {pending}건). 결과 보고율은 실패·중단을 포함해 결론이 난 하위 작업 중 결과가 게시된 비율입니다.',
  seconds: '{seconds}초',
  minutes: '{minutes}분 {seconds}초',
  byModel: '모델별 실행',
  noRuns: '아직 실행 기록이 없습니다. 앞으로의 에이전트 실행이 여기에 표시됩니다.',
  modelNote:
    '주 모델별 집계입니다. 시간에는 대기열이 포함되지 않습니다. 토큰과 비용은 보조 모델을 포함해 가져올 수 있었던 만큼 표시합니다.',
  columnModel: '모델',
  columnRuns: '실행',
  columnTime: '시간',
  columnTokens: '토큰',
  columnCost: 'API 비용',
  defaultModel: '기본 모델(이름 미확인)',
  average: '평균 {duration}',
  unavailable: '미확인',
  input: '입력 {count}',
  output: '출력 {count}',
  fetched: '확인 {done} / {total}건',
  local: '로컬 실행',
  estimated: '추정 · 확인 {done} / {total}건',
};
