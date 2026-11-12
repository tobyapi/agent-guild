import type { KeyboardEvent, ReactNode } from 'react';
import styles from './GuildForm.module.css';

export interface CrestChoicesProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** 選択肢の名前（読み上げとツールチップ） */
  name: (option: T) => string;
  /** 選択肢の見本（紋のプレビュー） */
  preview: (option: T) => ReactNode;
}

const STEPS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** 紋の形・色の選択（ラジオグループ。矢印キーで隣へ移る） */
export function CrestChoices<T extends string>({
  label,
  options,
  value,
  onChange,
  name,
  preview,
}: CrestChoicesProps<T>) {
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (option === undefined) return;
    onChange(option);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };
  return (
    <div className={styles.choices}>
      <span className={styles.label}>{label}</span>
      <div className={styles.options} role="radiogroup" aria-label={label}>
        {options.map((option, index) => (
          <button
            key={option}
            type="button"
            role="radio"
            className={styles.option}
            title={name(option)}
            aria-label={name(option)}
            aria-checked={option === value}
            tabIndex={option === value ? 0 : -1}
            onClick={() => onChange(option)}
            onKeyDown={(event) => move(event, index)}
          >
            {preview(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
