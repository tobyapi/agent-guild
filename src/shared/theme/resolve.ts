import { hasThemeVariants, safeAppearance } from './registry';
import { resolveBackground } from './backgrounds';
import type { AppearancePreference, ResolvedAppearance, Scheme, ThemeRegistry } from './types';

export function resolveAppearance(
  preference: AppearancePreference,
  registry: ThemeRegistry,
  systemScheme: Scheme,
): ResolvedAppearance {
  const selected = hasThemeVariants(registry, preference.themeId) ? preference : safeAppearance();
  const scheme = selected.schemePreference === 'system' ? systemScheme : selected.schemePreference;
  const background = resolveBackground(
    selected.backgroundOverride ?? registry[selected.themeId]?.variants[scheme].background ?? { kind: 'none' },
  );
  return {
    themeId: selected.themeId,
    scheme,
    accentOverride: selected.accentOverride,
    backgroundOverride: background,
    glass: background.kind === 'none' ? 'none' : 'frosted',
  };
}
