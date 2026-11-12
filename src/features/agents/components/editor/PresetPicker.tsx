import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { tEditor } from '../../i18n/editor';
import { searchPresets } from '../../model/personas/presetText';
import type { AnyPreset } from '../../model/personas/types';
import { PresetOptions } from './PresetOptions';
import styles from './PresetPicker.module.css';

export interface PresetPickerProps<T extends AnyPreset> {
  /** 何のプリセットか（「性格」「口調」）。ボタンと一覧の名前に使う */
  label: string;
  presets: readonly T[];
  onReplace: (preset: T) => void;
  onAppend: (preset: T) => void;
}

/** ［プリセット］ボタンと、その下に開く一覧（docs/persona-presets.md の UI。見た目はメンション補完に合わせる） */
export function PresetPicker<T extends AnyPreset>({ label, presets, onReplace, onAppend }: PresetPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  /** 閉じる。キーボードで閉じたときはボタンにフォーカスを戻す */
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) anchorRef.current?.querySelector('button')?.focus();
  };
  return (
    <span ref={anchorRef} className={styles.anchor}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        {tEditor('presetButton')}
      </button>
      {open && (
        <PresetPopover
          title={tEditor('presetTitle', { label })}
          presets={presets}
          anchorRef={anchorRef}
          onChoose={(preset, mode) => {
            if (mode === 'replace') onReplace(preset);
            else onAppend(preset);
            close(true);
          }}
          onClose={close}
        />
      )}
    </span>
  );
}

interface PresetPopoverProps<T extends AnyPreset> {
  title: string;
  presets: readonly T[];
  anchorRef: RefObject<HTMLSpanElement | null>;
  onChoose: (preset: T, mode: 'replace' | 'append') => void;
  onClose: (refocus: boolean) => void;
}

function PresetPopover<T extends AnyPreset>({ title, presets, anchorRef, onChoose, onClose }: PresetPopoverProps<T>) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const items = searchPresets(presets, query);
  const activeIndex = Math.min(active, items.length - 1);
  const current = items[activeIndex];
  useOutsideClick(anchorRef, () => onClose(false));

  const move = (step: number) => {
    if (items.length === 0) return;
    const next = (activeIndex + step + items.length) % items.length;
    setActive(next);
    document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' });
  };
  // ↑↓ で移動、Enter で置き換え（Shift+Enter で追記）、Esc で閉じる（Esc がダイアログまで届いて閉じないよう止める）
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    const handled = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key);
    if (!handled) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') onClose(true);
    else if (event.key === 'Enter' && current) onChoose(current, event.shiftKey ? 'append' : 'replace');
    else if (event.key !== 'Enter') move(event.key === 'ArrowDown' ? 1 : -1);
  };

  return (
    <div className={styles.popover} role="dialog" aria-label={title}>
      <input
        className={styles.search}
        type="search"
        value={query}
        placeholder={tEditor('presetSearch')}
        aria-label={tEditor('presetSearchLabel', { title })}
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={current ? `${listId}-${activeIndex}` : undefined}
        autoFocus
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {items.length === 0 ? (
        <p className={styles.empty}>{tEditor('presetNoMatch', { query: query.trim() })}</p>
      ) : (
        <PresetOptions
          id={listId}
          title={title}
          items={items}
          activeIndex={activeIndex}
          onHover={setActive}
          onChoose={onChoose}
        />
      )}
      <p className={styles.hints}>
        <kbd>↑</kbd>
        <kbd>↓</kbd> {tEditor('presetKeyChoose')} · <kbd>Enter</kbd> {tEditor('presetKeyConfirm')} · <kbd>Shift</kbd>+
        <kbd>Enter</kbd> {tEditor('presetKeyAppend')} · <kbd>Esc</kbd> {tEditor('presetKeyClose')}
      </p>
    </div>
  );
}

/** ボタンと一覧の外を押したら閉じる */
function useOutsideClick(ref: RefObject<HTMLElement | null>, onOutside: () => void): void {
  const latest = useRef(onOutside);
  useEffect(() => {
    latest.current = onOutside;
  });
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || ref.current?.contains(event.target)) return;
      latest.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [ref]);
}
