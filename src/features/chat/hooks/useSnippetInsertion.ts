import { useCallback, useRef } from 'react';
import type { CompositionEvent, RefObject } from 'react';
import { composerDrafts } from '../draftStore';
import { insertAtSelection } from '../model/stickers';

/**
 * 定型文（スタンプ）を下書きの選択範囲（なければキャレットの位置）へ差し込む。
 * IME で変換中に頼まれたら確定（compositionend）まで待ち、確定後の文へ差し込む。
 * 差し込んだあとのキャレットは pendingCaretRef に置き、useComposer の layout effect が入力欄へ反映する。
 * compositionend が届かないことがある（IME の切り替えや窓の切り替えなど）ので、変換中でないキー入力や
 * フォーカスが外れたことでも変換の終わりとみなす（settleComposition）。印が残って差し込みが黙って止まるのを防ぐ
 */
export function useSnippetInsertion(
  channelId: string,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  pendingCaretRef: RefObject<number | null>,
) {
  const composing = useRef(false);
  const queued = useRef<string[]>([]);

  const apply = useCallback(
    (snippet: string, refocus = true) => {
      const textarea = textareaRef.current;
      const current = composerDrafts.text(channelId);
      const start = textarea?.selectionStart ?? current.length;
      const end = textarea?.selectionEnd ?? start;
      const next = insertAtSelection(current, start, end, snippet);
      pendingCaretRef.current = next.caret;
      composerDrafts.setText(channelId, next.text);
      if (refocus) textarea?.focus();
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

  /** 待っていた定型文を、確定後の入力欄の値へ差し込む */
  const flush = (textarea: HTMLTextAreaElement, refocus: boolean) => {
    if (queued.current.length === 0) return;
    const snippet = queued.current.join('');
    queued.current = [];
    // 確定の input より先に compositionend が来るブラウザがあるので、確定後の値を下書きにそろえてから差し込む
    const value = textarea.value;
    if (value !== composerDrafts.text(channelId)) composerDrafts.setText(channelId, value);
    apply(snippet, refocus);
  };

  const onCompositionEnd = (event: CompositionEvent<HTMLTextAreaElement>) => {
    composing.current = false;
    flush(event.currentTarget, true);
  };

  /**
   * compositionend の代わりの合図（変換中でないキー入力・フォーカスが外れた）で変換中の印を下ろす。
   * フォーカスが外れたときは、ほかへ移ったフォーカスを奪わないよう refocus を false にする
   */
  const settleComposition = (textarea: HTMLTextAreaElement, refocus: boolean) => {
    if (!composing.current) return;
    composing.current = false;
    flush(textarea, refocus);
  };

  return { insertSnippet, onCompositionStart, onCompositionEnd, settleComposition };
}
