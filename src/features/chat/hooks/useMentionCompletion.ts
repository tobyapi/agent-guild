import { useCallback, useMemo, useState } from 'react';
import { filterMentionCandidates, refreshMentionQuery } from '../model/mentionQuery';
import type { MentionOption, MentionQuery } from '../model/mentionQuery';
import { activeIndexOf, stepIndex } from '../model/mentionSelection';
import type { MentionSelection } from '../model/mentionSelection';

/** メンション補完の状態: 入力中の「@…」・絞り込んだ候補・選択中の候補 */
export function useMentionCompletion(candidates: readonly MentionOption[]) {
  const [query, setQuery] = useState<MentionQuery | null>(null);
  const [selection, setSelection] = useState<MentionSelection>({ query: null, index: 0 });
  const matches = useMemo(() => (query ? filterMentionCandidates(candidates, query.query) : []), [candidates, query]);
  const activeIndex = activeIndexOf(selection, query, matches.length);

  /** 本文とキャレットから、入力中のメンションを取り直す（同じメンションなら状態を変えず、選択も保つ） */
  const sync = useCallback((text: string, caret: number) => {
    setQuery((current) => refreshMentionQuery(current, text, caret));
  }, []);

  const close = useCallback(() => setQuery(null), []);

  /** 候補を選ぶ（ホバー）。いまのメンションに対する選択として持つ */
  const select = useCallback((index: number) => setSelection({ query, index }), [query]);

  /** 選択を step だけ動かす（端では反対の端へ回る）。動かした先の位置を返す（候補がなければ null） */
  const move = useCallback(
    (step: number): number | null => {
      const next = stepIndex(activeIndex, step, matches.length);
      if (next !== null) setSelection({ query, index: next });
      return next;
    },
    [activeIndex, matches.length, query],
  );

  return { query, matches, open: query !== null, activeIndex, sync, close, move, select };
}
