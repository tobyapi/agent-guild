import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { useStore } from 'zustand';
import type { ChangeEvent, FocusEvent, KeyboardEvent, RefObject, SyntheticEvent } from 'react';
import { composerDrafts } from '../draftStore';
import { completionAction, isImeComposing, shouldSubmit } from '../model/keys';
import { insertMention } from '../model/mentionQuery';
import type { MentionOption } from '../model/mentionQuery';
import { sendMessage } from '../store';
import type { ComposerAttachments } from './useComposerAttachments';
import { useMentionCompletion } from './useMentionCompletion';
import { useSnippetInsertion } from './useSnippetInsertion';

/**
 * 入力欄: Enter で送信・Shift+Enter で改行・IME 変換中の Enter は送信しない・@ でメンション補完。
 * textarea の ref は呼び出し側が持つ（フックは描画中に ref を読まない）。添えた画像・ファイルは本文と一緒に送る
 */
export function useComposer(
  channelId: string,
  candidates: readonly MentionOption[],
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  pending: Pick<ComposerAttachments, 'attachments' | 'clear'>,
) {
  const text = useStore(composerDrafts.store, (state) => state.texts[channelId] ?? '');
  const setText = (value: string) => composerDrafts.setText(channelId, value);
  useEffect(() => () => composerDrafts.flush(), []);
  const pendingCaret = useRef<number | null>(null);
  const completion = useMentionCompletion(candidates);
  /** 候補の一覧（listbox）の id。各候補の id は `${listId}-${index}` */
  const listId = useId();

  // 候補を選んだあと、差し込んだ「@名前 」の直後にキャレットを置く
  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    textareaRef.current?.setSelectionRange(caret, caret);
    pendingCaret.current = null;
  }, [text, textareaRef]);

  const pick = (option: MentionOption | undefined) => {
    const textarea = textareaRef.current;
    if (!option || !textarea || !completion.query) return;
    const next = insertMention(text, completion.query, textarea.selectionStart, option.name);
    pendingCaret.current = next.caret;
    setText(next.text);
    completion.close();
    textarea.focus();
  };

  /** 定型文の差し込み（IME 変換中は確定まで待つ）。insertSnippet の参照は描画をまたいで変わらない */
  const snippets = useSnippetInsertion(channelId, textareaRef, pendingCaret);

  const submit = () => {
    const content = text.trim();
    const { attachments } = pending;
    if (content === '' && attachments.length === 0) return;
    setText('');
    pending.clear();
    completion.close();
    void sendMessage(channelId, content, attachments);
  };

  /** 候補が開いているときの ↑↓・Enter・Tab・Esc。扱ったら true */
  const handleCompletionKey = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    const action = completionAction(event.key);
    if (action === null || (action !== 'close' && completion.matches.length === 0)) return false;
    event.preventDefault();
    if (action === 'close') completion.close();
    else if (action === 'pick') pick(completion.matches[completion.activeIndex]);
    else revealOption(listId, completion.move(action === 'next' ? 1 : -1));
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const key = {
      key: event.key,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
      keyCode: event.nativeEvent.keyCode,
    };
    // 変換中でないキー入力が来たら変換は終わっている（compositionend が届かなかったときの保険）
    if (!isImeComposing(key)) snippets.settleComposition(event.currentTarget, true);
    if (!isImeComposing(key) && completion.open && handleCompletionKey(event)) return;
    if (!shouldSubmit(key)) return;
    event.preventDefault();
    submit();
  };

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    completion.sync(event.target.value, event.target.selectionStart);
  };

  /** キャレットが動いたら（クリック・矢印キー）入力中のメンションを取り直す */
  const onSelect = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    completion.sync(event.currentTarget.value, event.currentTarget.selectionStart);
  };

  /** フォーカスが外れたら候補を閉じ、変換中の印も下ろす（フォーカスは移った先に任せる） */
  const onBlur = (event: FocusEvent<HTMLTextAreaElement>) => {
    completion.close();
    snippets.settleComposition(event.currentTarget, false);
  };

  return { text, completion, listId, pick, submit, onKeyDown, onChange, onSelect, onBlur, ...snippets };
}

/**
 * ↑↓ で選んだ候補が一覧の外に隠れていたら、見えるところまで一覧をスクロールする（性格・口調のプリセットと同じ）。
 * ホバーで選んだ候補は見えているので、キー操作のときだけ呼ぶ
 */
function revealOption(listId: string, index: number | null): void {
  if (index === null) return;
  document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: 'nearest' });
}
