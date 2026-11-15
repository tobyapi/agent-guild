import { GENERATED_BACKGROUND_IDS } from './generatedBackgrounds';
import type { BackgroundSpec } from './types';

/** Accept library UUIDs and bundled IDs, never URLs or paths. */
export function resolveBackground(background: BackgroundSpec): BackgroundSpec {
  if (
    background.kind === 'image' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(background.assetId)
  )
    return background;
  if (background.kind === 'generated' && GENERATED_BACKGROUND_IDS.some((id) => id === background.presetId))
    return background;
  return { kind: 'none' };
}
