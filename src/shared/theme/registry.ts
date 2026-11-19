import type { AppearancePreference, ThemeDefinition, ThemeRegistry } from './types';

const guild: ThemeDefinition = {
  schemaVersion: 1,
  id: 'guild',
  variants: { dark: { background: { kind: 'none' } }, light: { background: { kind: 'none' } } },
};

export const themeRegistry: ThemeRegistry = { guild };

export function hasThemeVariants(registry: ThemeRegistry, id: string): boolean {
  const theme = Object.hasOwn(registry, id) ? registry[id] : undefined;
  return theme?.schemaVersion === 1 && theme.id === id && !!theme.variants.dark && !!theme.variants.light;
}

export function defaultAppearance(): AppearancePreference {
  return {
    version: 2,
    themeId: 'guild',
    schemePreference: 'dark',
    accentOverride: null,
    backgroundOverride: { kind: 'none' },
  };
}

export function safeAppearance(): AppearancePreference {
  return { ...defaultAppearance(), schemePreference: 'system' };
}
