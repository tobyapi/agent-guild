import { resolveBackground } from '@/shared/theme/backgrounds';
import type { BackgroundSpec, MotionPreference } from '@/shared/theme/types';
import { useBackdropMotion } from './useBackdropMotion';
import styles from './ThemeBackdrop.module.css';

interface Props {
  background: BackgroundSpec;
  motion: MotionPreference;
  imageUrl?: string | null;
}

/** Decorative only. Assets use library UUIDs, never user-provided paths. */
export function ThemeBackdrop({ background, motion, imageUrl }: Props) {
  const running = useBackdropMotion(motion);
  const resolved = resolveBackground(background);
  if (resolved.kind === 'none' || !imageUrl) return null;
  return (
    <div
      style={{ backgroundImage: `url("${imageUrl}")` }}
      aria-hidden="true"
      className={styles.backdrop}
      data-asset={resolved.assetId}
      data-running={running ? 'true' : 'false'}
    />
  );
}
