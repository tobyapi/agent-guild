// 割り振り（マネージャーのタスク。docs/design.md §7.1・docs/ui-design.md §5.13）の表示の判断。純粋な関数。
import type { Delegation, DelegationStatus, Subtask, SubtaskStatus } from '@/shared/types/domain';
import { t } from '../i18n';

const SUBTASK_STATUS_KEYS = {
  pending: 'subtaskPending',
  running: 'subtaskRunning',
  done: 'subtaskDone',
  failed: 'subtaskFailed',
  cancelled: 'subtaskCancelled',
} as const satisfies Record<SubtaskStatus, string>;

const DELEGATION_STATE_KEYS = {
  running: 'stateRunning',
  reporting: 'stateReporting',
  done: 'stateDone',
  cancelled: 'stateCancelled',
} as const satisfies Record<DelegationStatus, string>;

/** サブタスクの行の状態の言葉 */
export const subtaskStatusText = (status: SubtaskStatus): string => t(SUBTASK_STATUS_KEYS[status]);

/** カードの右上の全体の状態の札 */
export const delegationStateText = (status: DelegationStatus): string => t(DELEGATION_STATE_KEYS[status]);

/** 見出しの進み具合「3 件中 1 件完了」（失敗があれば「 · 失敗 1」を添える） */
export function progressText(delegation: Delegation): string {
  const count = (status: SubtaskStatus) => delegation.subtasks.filter((subtask) => subtask.status === status).length;
  const failed = count('failed');
  const text = t('progress', { total: delegation.subtasks.length, done: count('done') });
  return failed > 0 ? t('progressFailed', { text, failed }) : text;
}

/** サブタスクの行の導線（完了なら結果、失敗でエラー発言があればエラー）。なければ null */
export function resultLink(subtask: Subtask): { messageId: string; label: string } | null {
  if (subtask.resultMessageId === null) return null;
  if (subtask.status === 'done') return { messageId: subtask.resultMessageId, label: t('viewResult') };
  if (subtask.status === 'failed') return { messageId: subtask.resultMessageId, label: t('viewError') };
  return null;
}

/** 失敗・中止の理由（指示の下に1行で出す）。それ以外は null */
export function subtaskNote(subtask: Subtask): string | null {
  return subtask.status === 'failed' || subtask.status === 'cancelled' ? subtask.note : null;
}

/** 結果・まとめの発言からカードへ戻る導線（見出しの「↩ 割り振りの結果」「割り振りのまとめ」の札） */
export interface TaskLink {
  kind: 'result' | 'summary';
  /** 割り振りを書いたマネージャーの発言（カードがある発言） */
  planMessageId: string;
}

/** 発言 id → カードへ戻る導線（resultMessageId と summaryMessageId からの逆引き） */
export function taskLinkIndex(delegations: readonly Delegation[]): Map<string, TaskLink> {
  const index = new Map<string, TaskLink>();
  for (const delegation of delegations) {
    for (const subtask of delegation.subtasks) {
      if (subtask.resultMessageId !== null)
        index.set(subtask.resultMessageId, { kind: 'result', planMessageId: delegation.messageId });
    }
    if (delegation.summaryMessageId !== null)
      index.set(delegation.summaryMessageId, { kind: 'summary', planMessageId: delegation.messageId });
  }
  return index;
}

/** 新しいほうを残す（list_delegations の結果とイベントが入れ違っても古い値で上書きしない） */
export function isNewer(incoming: Delegation, current: Delegation | undefined): boolean {
  return current === undefined || incoming.updatedAt >= current.updatedAt;
}
