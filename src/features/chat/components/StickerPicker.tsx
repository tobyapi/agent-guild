import { memo, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { useLanguage } from '@/shared/i18n';
import { STICKERS } from '../model/stickers';
import { tComposer } from '../i18n/composer';
import styles from './StickerPicker.module.css';

export interface StickerPickerProps {
  /** 選んだ定型文を下書きへ差し込む（入力欄へのフォーカスの戻しも呼び出し側が行う）。参照は変えないこと */
  onInsert: (snippet: string) => void;
}

/**
 * 入力欄の横のスタンプボタンと定型文の一覧（menu）。
 * 開くと先頭の項目へフォーカスし、↑↓ / Home / End で移動、Enter・Space で選ぶ、Esc で閉じてボタンへ戻る。
 * 入力のたびに描き直さないよう memo し、一覧は開いているときだけ描く
 */
export const StickerPicker = memo(function StickerPicker({ onInsert }: StickerPickerProps) {
  // memo しているので、表示の言語を替えたときに描き直す
  useLanguage();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 開いたら先頭の項目へ。外を押したら閉じる（フォーカスは押した先に任せる）
  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const pick = (snippet: string) => {
    setOpen(false);
    onInsert(snippet);
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) =>
    handleMenuKey(event, itemRefs.current, (returnFocus) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    });

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const label = tComposer('stickerButton');
  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
      >
        <StickerGlyph />
      </button>
      {open && <StickerMenu menuId={menuId} itemRefs={itemRefs} onPick={pick} onKeyDown={onMenuKeyDown} />}
    </div>
  );
});

interface StickerMenuProps {
  menuId: string;
  itemRefs: RefObject<(HTMLButtonElement | null)[]>;
  onPick: (snippet: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/** 定型文の一覧（menu）。各項目はフォーカスの移動先として itemRefs に登録する */
function StickerMenu({ menuId, itemRefs, onPick, onKeyDown }: StickerMenuProps) {
  return (
    <div className={styles.popover} onKeyDown={onKeyDown}>
      <p className={styles.heading} aria-hidden="true">
        {tComposer('stickerHeading')}
      </p>
      <div id={menuId} role="menu" aria-label={tComposer('stickerHeading')} className={styles.list}>
        {STICKERS.map((sticker, index) => {
          const text = tComposer(sticker.key);
          return (
            <button
              key={sticker.id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={styles.item}
              onClick={() => onPick(text)}
            >
              <span className={styles.emoji} aria-hidden="true">
                {sticker.emoji}
              </span>
              <span className={styles.text}>{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 一覧の中のキー操作: ↑↓ で移動（端で折り返す）、Home / End で先頭・末尾、
 * Esc で閉じてボタンへ戻る、Tab で閉じる（フォーカスの移動はブラウザに任せる）
 */
function handleMenuKey(
  event: KeyboardEvent<HTMLDivElement>,
  items: readonly (HTMLButtonElement | null)[],
  close: (returnFocus: boolean) => void,
): void {
  const count = STICKERS.length;
  const focusItem = (index: number) => items[(index + count) % count]?.focus();
  const current = items.findIndex((item) => item === document.activeElement);
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      focusItem(current + 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      focusItem(current < 0 ? -1 : current - 1);
      break;
    case 'Home':
      event.preventDefault();
      focusItem(0);
      break;
    case 'End':
      event.preventDefault();
      focusItem(count - 1);
      break;
    case 'Escape':
      event.preventDefault();
      event.stopPropagation();
      close(true);
      break;
    case 'Tab':
      close(false);
      break;
  }
}

/** スタンプの独自アイコン（吹き出しに小さな星。線画で文字色に従う） */
function StickerGlyph() {
  return (
    <svg
      className={styles.glyph}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 5h16v11H10l-5 4v-4H4z" />
      <path d="M12 7.6l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" />
    </svg>
  );
}
