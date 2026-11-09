import { cx } from '@/shared/lib/cx';
import styles from './Crest.module.css';

export interface CrestProps {
  /** 灯をともす（ギルドのどこかで誰かが動いているとき） */
  lit?: boolean;
  /** md = 紋の行、lg = 空の状態・復旧画面 */
  size?: 'md' | 'lg';
  className?: string;
}

/** ギルドの紋: 菱に灯。装飾なので読み上げない */
export function Crest({ lit, size = 'md', className }: CrestProps) {
  return (
    <svg
      className={cx(styles.crest, styles[size], lit && styles.lit, className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.frame} d="M12 2.8 21.2 12 12 21.2 2.8 12Z" />
      <circle className={styles.core} cx="12" cy="12" r="3.3" />
    </svg>
  );
}
