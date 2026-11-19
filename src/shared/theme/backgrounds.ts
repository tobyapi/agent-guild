import type { BackgroundSpec } from './types';

/** Accept library UUIDs, never URLs or paths. */
export function resolveBackground(background: BackgroundSpec): BackgroundSpec {
  if (
    background.kind === 'image' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(background.assetId)
  )
    return background;
  return { kind: 'none' };
}
