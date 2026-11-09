// システム発言と注記の文面。Rust の guild-domain（conversation/notices.rs と delegation/verdict.rs）と同じ文面で、
// contracts/behavior/notices.json で両方を検査する。文面を変えるときは、Rust・実例・ここを同じ変更で直す。
import { MAX_SUBTASKS } from './delegation/tasks';

/** 停止したとき */
export const STOPPED = '停止しました';
/** AI 同士の往復が上限に達して振り分けを止めたとき（起点ごとに1回） */
export const DEPTH_LIMIT = 'AI 同士の往復が上限に達したので止めました。続けるにはメンションしてください。';
/** メンションなしの人間の発言に答えられるエージェントがいないとき */
export const NO_RESPONDER =
  'いま返答できるエージェントがいません（バックエンドの準備ができていないか、答える設定のメンバーがいません）';

/** チャンネル外のエージェントが呼ばれて自動で参加したとき */
export const joined = (name: string) => `${name} がチャンネルに参加しました`;
/** メンションされた相手がチャンネルにおらず、自動参加もしないとき */
export const undeliverable = (name: string) => `${name} はこのチャンネルにいないため、メッセージは届きませんでした`;
/** 相談相手が [PASS] や空の返答で終わったときの注記 */
export const didNotAnswer = (name: string) => `${name} は回答しませんでした`;
/** 相談相手の実行が失敗したときの注記 */
export const failed = (name: string) => `${name} は失敗しました`;

/** tasks ブロックに割り振れない名前があったとき */
export const unassignable = (names: readonly string[]) =>
  `${names.join('・')} には割り振れませんでした（見つからないか、自分自身です）`;
/** サブタスクが上限を超えたとき */
export const tooManyTasks = (names: readonly string[]) =>
  `サブタスクは${MAX_SUBTASKS}件までです。${names.join('・')} への割り振りは飛ばしました`;

/** サブタスクが失敗で決着したときの理由 */
export const SUBTASK_NOTES = {
  noAnswer: '回答がありませんでした',
  runFailed: '失敗しました',
  assigneeRemoved: '担当者が外れました',
} as const;
