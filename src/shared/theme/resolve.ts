import { hasThemeVariants, safeAppearance } from './registry';
import type { AppearancePreference, ResolvedAppearance, Scheme, ThemeRegistry } from './types';

export function resolveAppearance(
  preference: AppearancePreference,
  registry: ThemeRegistry,
  systemScheme: Scheme,
): ResolvedAppearance {
  const selected = hasThemeVariants(registry, preference.themeId) ? preference : safeAppearance();
  const scheme = selected.schemePreference === 'system' ? systemScheme : selected.schemePreference;
  const theme = Object.hasOwn(registry, selected.themeId) ? registry[selected.themeId] : undefined;
  return {
    themeId: selected.themeId,
    scheme,
    accentOverride: selected.accentOverride,
    backgroundOverride: selected.backgroundOverride ?? theme?.variants[scheme]?.background ?? { kind: 'none' },
    motion: selected.motionPreference,
  };
}
