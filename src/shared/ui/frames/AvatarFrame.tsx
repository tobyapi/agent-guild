import { builtinFrameSource } from './catalog';
import type { ResolvedFrame } from './catalog';
import styles from './AvatarFrame.module.css';

/**
 * アバターに重ねる枠（装飾。アバターの箱より外へはみ出す）。内蔵の枠も生成した枠も、独立した SVG を <img> で描く
 * （スクリプトは動かず、同じ絵は大きさごとに一度だけ描かれて使い回される）
 */
export function AvatarFrame({ frame }: { frame: ResolvedFrame }) {
  const src = frame.kind === 'custom' ? frame.src : builtinFrameSource(frame.id);
  if (!src) return null;
  return <img className={styles.frame} src={src} alt="" draggable={false} decoding="async" />;
}
