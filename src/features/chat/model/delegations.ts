// 割り振り（マネージャーのタスク。docs/design.md §7.1・docs/ui-design.md §5.13）の表示の判断。純粋な関数。
import type { Delegation, DelegationStatus, Subtask, SubtaskStatus } from '@/shared/types/domain';

export const SUBTASK_STATUS_TEXT: Readonly<Record<SubtaskStatus, string>> = {
  pending: '待機中',
  running: '作業中',
  done: '完了',
  failed: '失敗',
  cancelled: '中止',
};

/** カードの右上の全体の状態の札 */
export const DELEGATION_STATE_TEXT: Readonly<Record<DelegationStatus, string>> = {
  running: '進行中',
  reporting: 'まとめ中',
  done: '完了',
  cancelled: '打ち切り',
};

/** 見出しの進み具合「3 件中 1 件完了」（失敗があれば「 · 失敗 1」を添える） */
export function progressText(delegation: Delegation): string {
  const count = (status: SubtaskStatus) => delegation.subtasks.filter((subtask) => subtask.status === status).length;
  const failed = count('failed');
  const text = `${delegation.subtasks.length} 件中 ${count('done')} 件完了`;
  return failed > 0 ? `${text} · 失敗 ${failed}` : text;
}

/** サブタスクの行の導線（完了なら結果、失敗でエラー発言があればエラー）。なければ null */
export function resultLink(subtask: Subtask): { messageId: string; label: string } | null {
  if (subtask.resultMessageId === null) return null;
  if (subtask.status === 'done') return { messageId: subtask.resultMessageId, label: '結果を見る' };
  if (subtask.status === 'failed') return { messageId: subtask.resultMessageId, label: 'エラーを見る' };
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
      if (subtask.resultMessageId !== null) index.set(subtask.resultMessageId, { kind: 'result', planMessageId: delegation.messageId });
    }
    if (delegation.summaryMessageId !== null) index.set(delegation.summaryMessageId, { kind: 'summary', planMessageId: delegation.messageId });
  }
  return index;
}

/** 新しいほうを残す（list_delegations の結果とイベントが入れ違っても古い値で上書きしない） */
export function isNewer(incoming: Delegation, current: Delegation | undefined): boolean {
  return current === undefined || incoming.updatedAt >= current.updatedAt;
}
