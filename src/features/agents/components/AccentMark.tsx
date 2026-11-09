import type { CSSProperties } from 'react';
import { accentVars } from '@/shared/lib/accent';
import type { MemberAccent } from '../model/accent';
import styles from './AccentMark.module.css';

/** 区分の印: エージェントはアクセント色の菱（色が決まらなければ中立）、人間だけ丸（docs/ui-design.md §1） */
export function AccentMark({ accent, human = false }: { accent: MemberAccent; human?: boolean }) {
  return <i className={styles.mark} data-human={human ? '' : undefined} style={accentVars(accent) as CSSProperties | undefined} aria-hidden="true" />;
}
