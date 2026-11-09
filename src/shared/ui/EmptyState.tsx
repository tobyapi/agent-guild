import type { ReactNode } from 'react';
import { Crest } from './Crest';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title: ReactNode;
  children?: ReactNode;
  /** 主ボタン（あれば1つ） */
  action?: ReactNode;
}

/** 空の状態: 消えた灯の紋 → 見出し → 説明 → 主ボタン（docs/ui-design.md §7） */
export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <Crest size="lg" />
      <h3 className={styles.title}>{title}</h3>
      {children && <p className={styles.text}>{children}</p>}
      {action}
    </div>
  );
}
