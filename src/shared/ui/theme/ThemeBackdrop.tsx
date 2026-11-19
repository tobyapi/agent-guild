import { resolveBackground } from '@/shared/theme/backgrounds';
import type { BackgroundSpec } from '@/shared/theme/types';
import styles from './ThemeBackdrop.module.css';

interface Props {
  background: BackgroundSpec;
  imageUrl?: string | null;
}

/** Decorative only. Assets use library UUIDs, never user-provided paths. */
export function ThemeBackdrop({ background, imageUrl }: Props) {
  const resolved = resolveBackground(background);
  if (resolved.kind === 'none' || !imageUrl) return null;
  return (
    <div
      style={{ backgroundImage: `url("${imageUrl}")` }}
      aria-hidden="true"
      className={styles.backdrop}
      data-asset={resolved.assetId}
    />
  );
}
