import type { CSSProperties } from 'react';
import { avatarFallback, isImageAvatar } from '@/shared/lib/avatar';
import { cx } from '@/shared/lib/cx';
import { AvatarFrame } from './frames';
import type { ResolvedFrame } from './frames';
import styles from './Avatar.module.css';

export type AvatarSize = 'xs' | 'sm' | 'row' | 'md' | 'lg';

export interface AvatarProps {
  /** 絵文字などの短い文字、または data:image/... の画像 */
  avatar: string;
  /** アバターが空のときに頭文字を出すための名前 */
  name: string;
  /** タイルに溶かす個人色（名前の色） */
  color?: string;
  size?: AvatarSize;
  /** 丸は人、角は AI */
  human?: boolean;
  /** 動作中の灯をともす */
  busy?: boolean;
  /** 削除済みのエージェント（灰色で半透明） */
  deleted?: boolean;
  /** 重ねる枠（なしなら null か省略）。枠はアバターの箱より外へはみ出す */
  frame?: ResolvedFrame | null;
  className?: string;
}

/** アバター。装飾として扱い読み上げない（名前や状態は隣の文字で伝える） */
export function Avatar({ avatar, name, color, size = 'md', human, busy, deleted, frame, className }: AvatarProps) {
  const style = color ? ({ '--avatar-color': color } as CSSProperties) : undefined;
  return (
    <span
      className={cx(styles.avatar, styles[size], className)}
      data-human={human ? '' : undefined}
      data-deleted={deleted ? '' : undefined}
      data-framed={frame ? '' : undefined}
      style={style}
      aria-hidden="true"
    >
      {isImageAvatar(avatar) ? <img className={styles.image} src={avatar} alt="" /> : avatar || avatarFallback(name)}
      {frame && <AvatarFrame frame={frame} />}
      {busy && <span className={styles.lamp} />}
    </span>
  );
}
