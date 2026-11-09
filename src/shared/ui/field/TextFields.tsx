import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon } from '../Icon';
import { Field } from './Field';
import type { FieldProps } from './Field';
import styles from './Field.module.css';

type FieldFrame = Pick<FieldProps, 'label' | 'hint' | 'error' | 'optional' | 'labelAction'>;

interface ValueProps {
  value: string;
  onChange: (value: string) => void;
}

type Omitted = 'value' | 'onChange' | 'id' | 'className';

export type TextFieldProps = FieldFrame &
  ValueProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, Omitted> & {
    /** 数値の入力（幅を詰め、数字を等幅にする） */
    numeric?: boolean;
  };

export function TextField({
  label,
  hint,
  error,
  optional,
  labelAction,
  value,
  onChange,
  numeric,
  ...rest
}: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} labelAction={labelAction}>
      {(control) => (
        <input
          {...rest}
          {...control}
          className={cx(styles.control, numeric && styles.numeric)}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export type TextAreaFieldProps = FieldFrame &
  ValueProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, Omitted> & { mono?: boolean };

export function TextAreaField({
  label,
  hint,
  error,
  optional,
  labelAction,
  value,
  onChange,
  mono,
  ...rest
}: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} labelAction={labelAction}>
      {(control) => (
        <textarea
          {...rest}
          {...control}
          className={cx(styles.control, styles.textarea, mono && styles.mono)}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export type SelectFieldProps = FieldFrame &
  ValueProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, Omitted> & { children: ReactNode };

export function SelectField({
  label,
  hint,
  error,
  optional,
  labelAction,
  value,
  onChange,
  children,
  ...rest
}: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} labelAction={labelAction}>
      {(control) => (
        <div className={styles.selectWrap}>
          <select
            {...rest}
            {...control}
            className={cx(styles.control, styles.select)}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
            {children}
          </select>
          <Icon name="chevron" className={styles.chevron} />
        </div>
      )}
    </Field>
  );
}
