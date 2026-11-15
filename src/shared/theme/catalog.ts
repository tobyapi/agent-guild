import type { AppearancePreference, BackgroundSpec, SchemePreference } from './types';

/** Legacy v1 cards are retained for migration and the built-in art registry. */
export const themeCards = [
  { id: 'guild-dark', themeId: 'guild', scheme: 'dark', background: { kind: 'none' } },
  { id: 'guild-light', themeId: 'guild', scheme: 'light', background: { kind: 'none' } },
  { id: 'guild-system', themeId: 'guild', scheme: 'system', background: { kind: 'none' } },
] as const satisfies ReadonlyArray<{
  id: string;
  themeId: string;
  scheme: SchemePreference;
  background: BackgroundSpec;
}>;

export type ThemeCard = (typeof themeCards)[number];

export function selectThemeCard(preference: AppearancePreference, card: ThemeCard): AppearancePreference {
  return { ...preference, themeId: card.themeId, schemePreference: card.scheme, backgroundOverride: card.background };
}

/** Only call while migrating v1; new settings must never be coupled again. */
export function unifyAppearance(preference: AppearancePreference): AppearancePreference {
  if (preference.themeId !== 'guild') {
    const card = themeCards.find((choice) => choice.themeId === preference.themeId);
    return card ? selectThemeCard(preference, card) : preference;
  }
  const background = preference.backgroundOverride;
  const card = themeCards.find((choice) => JSON.stringify(choice.background) === JSON.stringify(background));
  return card && background?.kind !== 'none'
    ? selectThemeCard(preference, card)
    : { ...preference, backgroundOverride: { kind: 'none' } };
}
