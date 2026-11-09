import type { CSSProperties, ReactNode } from 'react';
import { accentVars } from '@/shared/lib/accent';
import { cx } from '@/shared/lib/cx';
import styles from './Badge.module.css';

/** outline は中立の線の札（振る舞いの要約・割り振りの導線など、塗りの札より弱く見せるもの） */
export type BadgeTone = 'neutral' | 'outline' | 'accent' | 'danger' | 'warning' | 'autonomous';

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** 役割の色（トークン --kind-<accent> / --kind-<accent>-soft を --tag-fg / --tag-bg で渡す）で染める。null なら tone の色 */
  accent?: string | null;
  title?: string;
}

/** 名前の横に置く札（先頭のタグ・自発など） */
export function Badge({ children, tone = 'neutral', accent, title }: BadgeProps) {
  const vars = accentVars(accent);
  return (
    <span
      className={cx(styles.badge, styles[vars ? 'tinted' : tone])}
      style={vars as CSSProperties | undefined}
      title={title}
    >
      {children}
    </span>
  );
}
