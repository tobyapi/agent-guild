import { resolveBackground } from '@/shared/theme/backgrounds';
import type { BackgroundSpec, MotionPreference } from '@/shared/theme/types';
import { useBackdropMotion } from './useBackdropMotion';
import styles from './ThemeBackdrop.module.css';

interface Props {
  background: BackgroundSpec;
  motion: MotionPreference;
  imageUrl?: string | null;
}

/** Decorative only. Assets use library UUIDs or bundled IDs, never user-provided paths. */
export function ThemeBackdrop({ background, motion, imageUrl }: Props) {
  const running = useBackdropMotion(motion);
  const resolved = resolveBackground(background);
  if (resolved.kind === 'none' || (resolved.kind === 'image' && !imageUrl)) return null;
  return (
    <div
      style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined}
      aria-hidden="true"
      className={styles.backdrop}
      data-asset={resolved.kind === 'image' ? resolved.assetId : undefined}
      data-scene={resolved.kind === 'scene' ? resolved.sceneId : undefined}
      data-running={running ? 'true' : 'false'}
    />
  );
}
