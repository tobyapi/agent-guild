import type { AppearancePreference, BackgroundSpec, SchemePreference } from './types';

/** The built-in cards bind scheme and art; the persisted v1 shape stays compatible. */
export const themeCards = [
  { id: 'guild-dark', themeId: 'guild', scheme: 'dark', background: { kind: 'none' } },
  { id: 'guild-light', themeId: 'guild', scheme: 'light', background: { kind: 'none' } },
  { id: 'guild-system', themeId: 'guild', scheme: 'system', background: { kind: 'none' } },
  { id: 'turtle', themeId: 'turtle', scheme: 'light', background: { kind: 'generated', presetId: 'tile-turtle' } },
  { id: 'dawn', themeId: 'dawn', scheme: 'light', background: { kind: 'image', assetId: 'dawn' } },
  { id: 'night', themeId: 'night', scheme: 'dark', background: { kind: 'image', assetId: 'night' } },
  { id: 'aurora', themeId: 'aurora', scheme: 'dark', background: { kind: 'scene', sceneId: 'aurora' } },
] as const satisfies ReadonlyArray<{
  id: string;
  themeId: string;
  scheme: SchemePreference;
  background: BackgroundSpec;
}>;

export type ThemeCard = (typeof themeCards)[number];

export function selectedThemeCard(preference: AppearancePreference): ThemeCard {
  return (
    themeCards.find((card) => card.themeId === preference.themeId && card.scheme === preference.schemePreference) ??
    themeCards[0]
  );
}

export function selectThemeCard(preference: AppearancePreference, card: ThemeCard): AppearancePreference {
  return { ...preference, themeId: card.themeId, schemePreference: card.scheme, backgroundOverride: null };
}

/** Old releases stored art independently. Keep this until their v1 settings are retired. */
export function unifyAppearance(preference: AppearancePreference): AppearancePreference {
  if (preference.themeId !== 'guild') {
    const card = themeCards.find((choice) => choice.themeId === preference.themeId);
    return card ? selectThemeCard(preference, card) : preference;
  }
  const background = preference.backgroundOverride;
  const card = themeCards.find((choice) => JSON.stringify(choice.background) === JSON.stringify(background));
  return card && background?.kind !== 'none'
    ? selectThemeCard(preference, card)
    : { ...preference, backgroundOverride: null };
}
