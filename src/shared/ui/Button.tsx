import type { ButtonHTMLAttributes } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './Button.module.css';

/** danger は削除の入口、dangerSolid は確認ダイアログの「削除する」だけ、link は「既定に戻す」のような文字だけの操作 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSolid' | 'link';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** 文字のボタン。type の既定は "button"（フォームを誤って送信しない） */
export function Button({ variant = 'secondary', size = 'md', type = 'button', className, ...rest }: ButtonProps) {
  return <button type={type} className={cx(styles.button, styles[variant], styles[size], className)} {...rest} />;
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** 読み上げとツールチップに使うラベル（必須） */
  label: string;
}

/** アイコンだけのボタン。ラベルは aria-label とツールチップに入る */
export function IconButton({ label, type = 'button', className, ...rest }: IconButtonProps) {
  return <button type={type} aria-label={label} title={label} className={cx(styles.iconButton, className)} {...rest} />;
}
