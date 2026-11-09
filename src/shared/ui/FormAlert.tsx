import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './FormAlert.module.css';

/** フォームの先頭に出すエラーの帯（どの入力のことか分からない失敗を伝える） */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div className={styles.alert} role="alert">
      <Icon name="alert" className={styles.icon} />
      <span>{children}</span>
    </div>
  );
}
