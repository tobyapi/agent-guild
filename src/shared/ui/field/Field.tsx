import { useId } from 'react';
import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon } from '../Icon';
import styles from './Field.module.css';

/** 入力要素に渡す属性（ラベル・補足・エラーとの結びつけ） */
export interface ControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** ラベルの後ろに「任意」を添える */
  optional?: boolean;
  /** ラベルの行の右端に置くもの（「既定に戻す」など） */
  labelAction?: ReactNode;
  className?: string;
  children: (control: ControlProps) => ReactNode;
}

/** ラベル・入力要素・補足・エラーの並び。入力要素は children の関数で描く */
export function Field({ label, hint, error, optional, labelAction, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  return (
    <div className={cx(styles.field, className)}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {optional && <span className={styles.labelNote}>任意</span>}
        </label>
        {labelAction}
      </div>
      {children({ id, 'aria-describedby': describedBy || undefined, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId} message={error} />}
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} className={styles.error}>
      <Icon name="alert" className={styles.errorIcon} />
      {message}
    </p>
  );
}
