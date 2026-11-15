import { useBackdropEnvironment } from './useBackdropEnvironment';
import { useAppearanceStore } from '@/features/settings';
import { themeRegistry } from '@/shared/theme/registry';
import { resolveAppearance } from '@/shared/theme/resolve';
import { ThemeBackdrop } from '@/shared/ui/theme/ThemeBackdrop';

/** App wiring owns the settings dependency; the shared renderer only receives data. */
export function AppearanceBackdrop() {
  const preference = useAppearanceStore((state) => state.preference);
  const { scheme } = useBackdropEnvironment();
  const appearance = resolveAppearance(preference, themeRegistry, scheme);
  return <ThemeBackdrop background={appearance.backgroundOverride} motion={appearance.motion} />;
}
