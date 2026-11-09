// 割り振りの状態の移り変わり（docs/design.md §7.1 の 2〜7）。純粋な関数で、新しい値を返す。
import type { Delegation, Subtask, SubtaskStatus } from '@/shared/types/domain';

export interface SubtaskResult {
  status: Extract<SubtaskStatus, 'done' | 'failed' | 'cancelled'>;
  resultMessageId: string | null;
  note: string | null;
}

/** まとめに渡す結果の長さの上限（1件） */
export const REPORT_RESULT_MAX = 8000;

export const isUnsettled = (subtask: Subtask) => subtask.status === 'pending' || subtask.status === 'running';

/** まだ決着していない割り振り（打ち切りの対象） */
export const isOpen = (delegation: Delegation) => delegation.status === 'running' || delegation.status === 'reporting';

function updateSubtask(delegation: Delegation, subtaskId: string, change: (subtask: Subtask) => Subtask, now: number): Delegation {
  return {
    ...delegation,
    subtasks: delegation.subtasks.map((subtask) => (subtask.id === subtaskId ? change(subtask) : subtask)),
    updatedAt: now,
  };
}

/** ジョブの実行が始まった: pending → running */
export function startSubtask(delegation: Delegation, subtaskId: string, now: number): Delegation {
  return updateSubtask(delegation, subtaskId, (subtask) => (subtask.status === 'pending' ? { ...subtask, status: 'running' } : subtask), now);
}

/** サブタスクの決着（決着済みなら変えない） */
export function settleSubtask(delegation: Delegation, subtaskId: string, result: SubtaskResult, now: number): Delegation {
  return updateSubtask(delegation, subtaskId, (subtask) => (isUnsettled(subtask) ? { ...subtask, ...result } : subtask), now);
}

/** すべてのサブタスクが決着したか（待ち合わせ） */
export function allSettled(delegation: Delegation): boolean {
  return delegation.subtasks.every((subtask) => !isUnsettled(subtask));
}

/** 打ち切り: 割り振りを cancelled にし、未決着のサブタスクも理由つきで cancelled にする */
export function cancelDelegation(delegation: Delegation, note: string, now: number): Delegation {
  return {
    ...delegation,
    status: 'cancelled',
    subtasks: delegation.subtasks.map((subtask) => (isUnsettled(subtask) ? { ...subtask, status: 'cancelled', note } : subtask)),
    updatedAt: now,
  };
}

const STATUS_TEXT: Readonly<Record<SubtaskStatus, string>> = {
  pending: '待機中',
  running: '作業中',
  done: '完了',
  failed: '失敗',
  cancelled: '中止',
};

/**
 * まとめのジョブに渡すサブタスクごとの行（担当者・指示・状態・結果か理由）。
 * resultOf はサブタスクの結果の発言の本文（なければ null）
 */
export function reportLines(delegation: Delegation, nameOf: (agentId: string) => string, resultOf: (subtask: Subtask) => string | null): string[] {
  return delegation.subtasks.map((subtask) => {
    const result = resultOf(subtask)?.slice(0, REPORT_RESULT_MAX) ?? subtask.note ?? '';
    return `${nameOf(subtask.assigneeId)}｜${subtask.instruction}｜${STATUS_TEXT[subtask.status]}｜${result}`;
  });
}
