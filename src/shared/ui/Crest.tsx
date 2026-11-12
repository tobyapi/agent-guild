import type { CrestColor, CrestShape } from '@/shared/types/domain';
import { cx } from '@/shared/lib/cx';
import styles from './Crest.module.css';
import { CREST_GEOMETRY } from './crestShapes';

export interface CrestProps {
  /** 灯をともす（ギルドのどこかで誰かが動いているとき） */
  lit?: boolean;
  /** md = 紋の行、lg = 空の状態・復旧画面 */
  size?: 'md' | 'lg';
  /** 形（既定は菱） */
  shape?: CrestShape;
  /** 枠の色（default は文字の色。値はトークン --crest-<色>） */
  color?: CrestColor;
  className?: string;
}

/** ギルドの紋: 枠に灯。装飾なので読み上げない */
export function Crest({ lit, size = 'md', shape = 'diamond', color = 'default', className }: CrestProps) {
  const { frame, core } = CREST_GEOMETRY[shape] ?? CREST_GEOMETRY.diamond;
  return (
    <svg
      className={cx(styles.crest, styles[size], color !== 'default' && styles[color], lit && styles.lit, className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      data-shape={shape}
    >
      <path className={styles.frame} d={frame} />
      <circle className={styles.core} cx={core.cx} cy={core.cy} r={core.r} />
    </svg>
  );
}
