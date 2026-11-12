import { Fragment } from 'react';
import { tEditor } from '../../i18n/editor';
import { groupHeadingAt } from '../../model/personas/presetText';
import type { AnyPreset } from '../../model/personas/types';
import styles from './PresetOptions.module.css';

export interface PresetOptionsProps<T extends AnyPreset> {
  /** listbox の id（検索欄の aria-controls から指す）。各項目の id は `${id}-${index}` */
  id: string;
  title: string;
  items: readonly T[];
  activeIndex: number;
  onHover: (index: number) => void;
  onChoose: (preset: T, mode: 'replace' | 'append') => void;
}

/**
 * プリセットの一覧（docs/persona-presets.md）。組が変わるところに見出しを挟む
 * （メンション補完の「チャンネル外」と同じ区切り。見出しは選べず、↑↓ は項目だけを動く）。
 * マウスは動かしたときだけ選択を移す。onMouseEnter だと、↑↓ で一覧がスクロールして止まっているマウスの下に
 * 来た行にも選択が移り、キーボードで選んだ項目が奪われる（スクロールでは mousemove は起きない）
 */
export function PresetOptions<T extends AnyPreset>({
  id,
  title,
  items,
  activeIndex,
  onHover,
  onChoose,
}: PresetOptionsProps<T>) {
  return (
    <ul id={id} role="listbox" aria-label={title} className={styles.list}>
      {items.map((preset, index) => {
        const heading = groupHeadingAt(items, index);
        return (
          <Fragment key={preset.id}>
            {heading !== null && (
              <li role="presentation" className={styles.separator}>
                {heading}
              </li>
            )}
            <li
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={styles.option}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={index === activeIndex ? undefined : () => onHover(index)}
              onClick={() => onChoose(preset, 'replace')}
            >
              <span className={styles.label}>{preset.label}</span>
              <button
                type="button"
                className={styles.append}
                tabIndex={-1}
                onClick={(event) => {
                  event.stopPropagation();
                  onChoose(preset, 'append');
                }}
              >
                {tEditor('presetAppend')}
              </button>
              <span className={styles.text}>{preset.text}</span>
              {preset.sample && (
                <span className={styles.sample}>{tEditor('presetSample', { sample: preset.sample })}</span>
              )}
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}
