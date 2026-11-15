import { resolveBackground } from '@/shared/theme/backgrounds';
import type { BackgroundSpec, MotionPreference } from '@/shared/theme/types';
import { useBackdropMotion } from './useBackdropMotion';
import styles from './ThemeBackdrop.module.css';

interface Props {
  background: BackgroundSpec;
  motion: MotionPreference;
}

/** Decorative only. Assets are addressed by bundled IDs, never user-provided paths. */
export function ThemeBackdrop({ background, motion }: Props) {
  const running = useBackdropMotion(motion);
  const resolved = resolveBackground(background);
  if (resolved.kind === 'none') return null;
  return (
    <div
      aria-hidden="true"
      className={styles.backdrop}
      data-asset={resolved.kind === 'image' ? resolved.assetId : undefined}
      data-scene={resolved.kind === 'scene' ? resolved.sceneId : undefined}
      data-running={running ? 'true' : 'false'}
    />
  );
}
