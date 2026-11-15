import { useBackdropEnvironment } from './useBackdropEnvironment';
import { useBackgroundImage, useAppearanceStore } from '@/features/settings';
import { themeRegistry } from '@/shared/theme/registry';
import { resolveAppearance } from '@/shared/theme/resolve';
import { ThemeBackdrop } from '@/shared/ui/theme/ThemeBackdrop';

/** App wiring owns the settings dependency; the shared renderer only receives data. */
export function AppearanceBackdrop() {
  const preference = useAppearanceStore((state) => state.preference);
  const { scheme } = useBackdropEnvironment();
  const appearance = resolveAppearance(preference, themeRegistry, scheme);
  const background = appearance.backgroundOverride;
  const imageUrl = useBackgroundImage(background.kind === 'image' ? background.assetId : null);
  return <ThemeBackdrop background={background} motion={appearance.motion} imageUrl={imageUrl} />;
}
