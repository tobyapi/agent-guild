import type { BackgroundSpec } from './types';

export const BACKGROUND_ASSET_IDS = ['dawn', 'night'] as const;
export const BACKGROUND_SCENE_IDS = ['aurora'] as const;

/** Only bundled IDs are accepted; never interpret a saved ID as a URL or path. */
export function resolveBackground(background: BackgroundSpec): BackgroundSpec {
  if (background.kind === 'image' && BACKGROUND_ASSET_IDS.some((id) => id === background.assetId)) return background;
  if (background.kind === 'scene' && BACKGROUND_SCENE_IDS.some((id) => id === background.sceneId)) return background;
  return { kind: 'none' };
}
