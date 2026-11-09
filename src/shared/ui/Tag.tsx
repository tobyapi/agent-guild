import type { ReactNode } from 'react';
import styles from './Tag.module.css';

export type TagTone = 'neutral' | 'warning' | 'danger';

export interface TagProps {
  children: ReactNode;
  tone?: TagTone;
  title?: string;
}

/** 等幅の小さな枠つきラベル（バックエンド名など、識別子を示すもの） */
export function Tag({ children, tone = 'neutral', title }: TagProps) {
  return (
    <span className={styles.tag} data-tone={tone} title={title}>
      {children}
    </span>
  );
}
