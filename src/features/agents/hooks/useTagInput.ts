import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { commitTagText, removeTag, TAG_SEPARATOR } from '../model/tagInput';

/**
 * タグの入力欄の操作: Enter・空白・カンマ・読点で札にし、空のまま Backspace で最後の札を外す。
 * 日本語の変換中は区切らない（読点や Enter は変換の確定に使われる）
 */
export function useTagInput(tags: readonly string[], onChange: (tags: string[]) => void) {
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const composing = useRef(false);

  const commit = (value: string) => {
    const result = commitTagText(tags, value);
    if (!result.ok) return setProblem(result.error);
    setText('');
    setProblem(null);
    if (result.tags.length !== tags.length) onChange(result.tags);
  };
  const changeText = (value: string) => {
    setProblem(null);
    if (!composing.current && TAG_SEPARATOR.test(value)) commit(value);
    else setText(value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(text);
    } else if (event.key === 'Backspace' && text === '' && tags.length > 0) {
      onChange(removeTag(tags, tags.length - 1));
    }
  };
  const onCompositionStart = () => {
    composing.current = true;
  };
  const onCompositionEnd = (value: string) => {
    composing.current = false;
    changeText(value);
  };
  /** 入力欄から離れたら、打ちかけの文字も札にする */
  const flush = () => {
    if (text.trim() !== '') commit(text);
  };

  return { text, problem, changeText, onKeyDown, onCompositionStart, onCompositionEnd, flush };
}
