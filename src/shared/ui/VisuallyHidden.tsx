import type { ReactNode } from 'react';
import styles from './VisuallyHidden.module.css';

/** 画面には出さず、読み上げだけに届ける文字 */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className={styles.hidden}>{children}</span>;
}
