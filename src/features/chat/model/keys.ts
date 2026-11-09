// 入力欄のキー操作の判定（純粋な関数）。

export interface ComposerKey {
  key: string;
  shiftKey: boolean;
  /** KeyboardEvent.isComposing */
  isComposing: boolean;
  /** KeyboardEvent.keyCode（IME 処理中は 229） */
  keyCode: number;
}

/**
 * IME で変換中か。変換を確定する Enter も含む。
 * Safari は確定の Enter で isComposing が false になるため、keyCode 229 も見る。
 */
export function isImeComposing(event: Pick<ComposerKey, 'isComposing' | 'keyCode'>): boolean {
  return event.isComposing || event.keyCode === 229;
}

/** Enter で送信、Shift+Enter は改行。IME 変換中の Enter では送信しない */
export function shouldSubmit(event: ComposerKey): boolean {
  return event.key === 'Enter' && !event.shiftKey && !isImeComposing(event);
}

export type CompletionAction = 'next' | 'previous' | 'pick' | 'close';

/** メンション候補を開いているときのキー操作。候補の操作でなければ null */
export function completionAction(key: string): CompletionAction | null {
  switch (key) {
    case 'ArrowDown':
      return 'next';
    case 'ArrowUp':
      return 'previous';
    case 'Enter':
    case 'Tab':
      return 'pick';
    case 'Escape':
      return 'close';
    default:
      return null;
  }
}
