import { useId } from 'react';
import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import choiceStyles from './ChoiceFields.module.css';
import fieldStyles from './Field.module.css';

const styles = { ...fieldStyles, ...choiceStyles };

export interface CheckboxFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** 複数選択の一覧の1行（メンバーの選択など）。オン・オフの設定にはスイッチを使う */
export function CheckboxField({ label, hint, checked, disabled, onChange }: CheckboxFieldProps) {
  const hintId = useId();
  return (
    <div className={styles.field}>
      <label className={styles.choice}>
        <input
          type="checkbox"
          className={styles.choiceInput}
          checked={checked}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{label}</span>
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

export interface RadioOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
}

export interface RadioGroupProps<T extends string> {
  legend: ReactNode;
  value: T;
  options: ReadonlyArray<RadioOption<T>>;
  onChange: (value: T) => void;
  /** カードを並べる列の数（4 択を 2×2 に並べるときは 2。狭いときは 1 列に戻る） */
  columns?: 1 | 2;
}

/** ラジオカード: 説明が要る択一（保存先の変更のしかた・メンションのない発言への振る舞いなど） */
export function RadioGroup<T extends string>({ legend, value, options, onChange, columns = 1 }: RadioGroupProps<T>) {
  const name = useId();
  return (
    <fieldset className={cx(styles.fieldset, columns === 2 && styles.twoColumns)}>
      <legend className={styles.label}>{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className={cx(styles.choice, styles.card, option.value === value && styles.checked)}>
          <input
            type="radio"
            className={styles.choiceInput}
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span className={styles.choiceText}>
            <span className={styles.choiceTitle}>{option.label}</span>
            {option.description && <span className={styles.hint}>{option.description}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
