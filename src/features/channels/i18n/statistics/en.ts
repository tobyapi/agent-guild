import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const en: Messages<typeof ja> = {
  title: 'Usage statistics',
  description: '# {name} · All time',
  refresh: 'Refresh',
  loading: 'Loading usage statistics…',
  loadFailed: 'Could not load statistics. {error}',
  delegation: 'Delegation',
  delegationCount: 'Delegations',
  reportRate: 'Result report rate',
  failedSubtasks: 'Failed subtasks',
  cancelledSubtasks: 'Interrupted subtasks',
  count: '{count}',
  ratio: '{done} / {total}',
  delegationNote:
    '{subtasks} subtasks ({pending} unsettled). The result report rate is the share of settled subtasks, including failed and interrupted ones, whose result was posted.',
  seconds: '{seconds} s',
  minutes: '{minutes} min {seconds} s',
  byModel: 'Runs by model',
  noRuns: 'No runs recorded yet. Future agent runs will appear here.',
  modelNote:
    'Totals per primary model. Time excludes queueing. Tokens and costs show what could be collected, including auxiliary models.',
  columnModel: 'Model',
  columnRuns: 'Runs',
  columnTime: 'Time',
  columnTokens: 'Tokens',
  columnCost: 'API cost',
  defaultModel: 'Default model (name unknown)',
  average: 'avg {duration}',
  unavailable: 'Not available',
  input: 'In {count}',
  output: 'Out {count}',
  fetched: 'Collected {done} / {total}',
  local: 'Local run',
  estimated: 'Estimated · collected {done} / {total}',
};
