import { GENERATED_BACKGROUND_IDS } from './generatedBackgrounds';
import type { BackgroundSpec } from './types';

/** Only bundled IDs are accepted; never interpret a saved ID as a URL or path. */
export function resolveBackground(background: BackgroundSpec): BackgroundSpec {
  if (background.kind === 'generated' && GENERATED_BACKGROUND_IDS.some((id) => id === background.presetId))
    return background;
  return { kind: 'none' };
}
