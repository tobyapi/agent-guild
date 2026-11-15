import { themeCards } from './catalog';
import type { AppearancePreference, ThemeDefinition, ThemeRegistry } from './types';

const guild: ThemeDefinition = {
  schemaVersion: 1,
  id: 'guild',
  variants: { dark: { background: { kind: 'none' } }, light: { background: { kind: 'none' } } },
};

export const themeRegistry: ThemeRegistry = Object.fromEntries([
  ['guild', guild],
  ...themeCards
    .filter((card) => card.themeId !== 'guild')
    .map((card): [string, ThemeDefinition] => [
      card.themeId,
      {
        schemaVersion: 1,
        id: card.themeId,
        variants: { dark: { background: card.background }, light: { background: card.background } },
      },
    ]),
]);

export function hasThemeVariants(registry: ThemeRegistry, id: string): boolean {
  const theme = Object.hasOwn(registry, id) ? registry[id] : undefined;
  return theme?.schemaVersion === 1 && theme.id === id && !!theme.variants.dark && !!theme.variants.light;
}

export function defaultAppearance(): AppearancePreference {
  return {
    version: 1,
    themeId: 'guild',
    schemePreference: 'dark',
    accentOverride: null,
    backgroundOverride: null,
    motionPreference: 'system',
  };
}

export function safeAppearance(): AppearancePreference {
  return { ...defaultAppearance(), schemePreference: 'system' };
}
