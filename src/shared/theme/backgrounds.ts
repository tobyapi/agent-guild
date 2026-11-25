import type { BackgroundSpec } from './types';

export function isBackgroundAssetId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
}

/** Accept library UUIDs, never URLs or paths. */
export function resolveBackground(background: BackgroundSpec): BackgroundSpec {
  if (background.kind === 'mascot' || (background.kind === 'image' && isBackgroundAssetId(background.assetId)))
    return background;
  return { kind: 'none' };
}
