/**
 * マネージャーの割り振り（design.md §7.1）。マネージャーの発言の tasks ブロックから作られ、
 * サブタスクがすべて決着したら、マネージャーに結果がまとめて戻る（report ジョブ）。
 */

/**
 * - pending: 担当者の実行待ち
 * - running: 担当者が作業中（相談相手の回答待ちを含む）
 * - done: 担当者が結果を報告した
 * - failed: 回答なし・失敗・時間切れ・担当者の削除や除外
 * - cancelled: 停止などで打ち切られた
 */
export type SubtaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export interface Subtask {
  id: string;
  assigneeId: string;
  /** マネージャーが書いた指示 */
  instruction: string;
  status: SubtaskStatus;
  /** 結果の報告（done のとき）や失敗の記録（failed のとき、エラー発言があれば）の発言 */
  resultMessageId: string | null;
  /** failed / cancelled の理由（例: 「回答がありませんでした」「時間切れ」）。それ以外は null */
  note: string | null;
}

/**
 * - running: サブタスクのどれかが未決着
 * - reporting: 全サブタスクが決着し、マネージャーがまとめを書いている
 * - done: マネージャーのまとめが投稿された（まとめが [PASS] や失敗でも done にし、summaryMessageId は null）
 * - cancelled: 停止・チャンネル削除・マネージャーの削除で打ち切られた
 */
export type DelegationStatus = 'running' | 'reporting' | 'done' | 'cancelled';

export interface Delegation {
  id: string;
  channelId: string;
  managerId: string;
  /** tasks ブロックを含むマネージャーの発言 */
  messageId: string;
  status: DelegationStatus;
  /** tasks ブロックに書かれた順 */
  subtasks: Subtask[];
  /** マネージャーのまとめの発言 */
  summaryMessageId: string | null;
  createdAt: number;
  updatedAt: number;
}
