import { useId } from 'react';
import type { ReactNode } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** 読み上げ用の名前（見えるラベルがあれば labelledBy を使う） */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
  /** warning は危険な権限のスイッチ（オンを柿色にして「普通のオン」と区別する） */
  tone?: 'accent' | 'warning';
}

export function Switch({ checked, onChange, label, labelledBy, describedBy, disabled, tone = 'accent' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      className={styles.switch}
      data-tone={tone}
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export interface SwitchFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** スイッチの行: 左にラベルとヘルプ、右にスイッチ */
export function SwitchField({ label, hint, checked, onChange, disabled }: SwitchFieldProps) {
  const id = useId();
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <span id={`${id}-label`} className={styles.label}>
          {label}
        </span>
        {hint && (
          <span id={`${id}-hint`} className={styles.hint}>
            {hint}
          </span>
        )}
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        labelledBy={`${id}-label`}
        describedBy={hint ? `${id}-hint` : undefined}
        disabled={disabled}
      />
    </div>
  );
}
