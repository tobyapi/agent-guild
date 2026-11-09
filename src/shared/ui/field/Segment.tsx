import type { KeyboardEvent, ReactNode } from 'react';
import styles from './Segment.module.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentProps<T extends string> {
  /** 読み上げ用の名前 */
  label: string;
  value: T;
  options: ReadonlyArray<SegmentOption<T>>;
  onChange: (value: T) => void;
  describedBy?: string;
}

const STEPS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** 矢印キーで隣の選択肢へ移り、選ぶ（ラジオグループのキーボード操作） */
function handleArrows<T extends string>(event: KeyboardEvent<HTMLButtonElement>, index: number, props: SegmentProps<T>) {
  const step = STEPS[event.key];
  if (step === undefined) return;
  event.preventDefault();
  const next = (index + step + props.options.length) % props.options.length;
  const option = props.options[next];
  if (!option) return;
  props.onChange(option.value);
  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
  buttons?.[next]?.focus();
}

/** セグメント: 2〜4 個の短い択一（テンプレート、短い選択肢の設定など） */
export function Segment<T extends string>(props: SegmentProps<T>) {
  const { label, value, options, onChange, describedBy } = props;
  const selected = options.some((option) => option.value === value);
  return (
    <div className={styles.segment} role="radiogroup" aria-label={label} aria-describedby={describedBy}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          className={styles.item}
          aria-checked={option.value === value}
          tabIndex={option.value === value || (!selected && index === 0) ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => handleArrows(event, index, props)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
