import { useCallback, useRef } from 'react';
import type { CompositionEvent, RefObject } from 'react';
import { composerDrafts } from '../draftStore';
import { insertAtSelection } from '../model/stickers';

/**
 * 定型文（スタンプ）を下書きの選択範囲（なければキャレットの位置）へ差し込む。
 * IME で変換中に頼まれたら確定（compositionend）まで待ち、確定後の文へ差し込む。
 * 差し込んだあとのキャレットは pendingCaretRef に置き、useComposer の layout effect が入力欄へ反映する
 */
export function useSnippetInsertion(
  channelId: string,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  pendingCaretRef: RefObject<number | null>,
) {
  const composing = useRef(false);
  const queued = useRef<string[]>([]);

  const apply = useCallback(
    (snippet: string) => {
      const textarea = textareaRef.current;
      const current = composerDrafts.text(channelId);
      const start = textarea?.selectionStart ?? current.length;
      const end = textarea?.selectionEnd ?? start;
      const next = insertAtSelection(current, start, end, snippet);
      pendingCaretRef.current = next.caret;
      composerDrafts.setText(channelId, next.text);
      textarea?.focus();
    },
    [channelId, textareaRef, pendingCaretRef],
  );

  /** 参照は描画をまたいで変わらない（一覧の部品を入力のたびに描き直さない） */
  const insertSnippet = useCallback(
    (snippet: string) => {
      if (snippet === '') return;
      if (composing.current) queued.current.push(snippet);
      else apply(snippet);
    },
    [apply],
  );

  const onCompositionStart = () => {
    composing.current = true;
  };

  const onCompositionEnd = (event: CompositionEvent<HTMLTextAreaElement>) => {
    composing.current = false;
    if (queued.current.length === 0) return;
    const snippet = queued.current.join('');
    queued.current = [];
    // 確定の input より先に compositionend が来るブラウザがあるので、確定後の値を下書きにそろえてから差し込む
    const value = event.currentTarget.value;
    if (value !== composerDrafts.text(channelId)) composerDrafts.setText(channelId, value);
    apply(snippet);
  };

  return { insertSnippet, onCompositionStart, onCompositionEnd };
}
