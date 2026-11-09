// メンション補完の候補の選択（docs/ui-design.md §5.6）。純粋なロジック。
import type { MentionQuery } from './mentionQuery';

/**
 * 選択中の候補。どの入力中のメンションに対する選択かを一緒に持ち、メンションが別の値に変わると先頭に戻る。
 * キャレットの読み直しは ↑↓ と同じキー操作の中でも届くことがあるので、選択を先頭に戻すのは
 * メンションが変わったとき（refreshMentionQuery が新しい値を返したとき）だけにする
 */
export interface MentionSelection {
  query: MentionQuery | null;
  index: number;
}

/** いまのメンションでの選択位置。別のメンションに対する選択なら先頭。候補の数に収める */
export function activeIndexOf(selection: MentionSelection, query: MentionQuery | null, count: number): number {
  const index = selection.query === query ? selection.index : 0;
  return Math.min(index, Math.max(count - 1, 0));
}

/** step だけ動かした位置（端では反対の端へ回る）。候補がなければ null */
export function stepIndex(active: number, step: number, count: number): number | null {
  return count === 0 ? null : (active + step + count) % count;
}
