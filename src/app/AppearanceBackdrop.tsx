import { useId } from 'react';
import { TileTurtleBackdrop } from '@/shared/ui/theme/TileTurtleBackdrop';
import { tileTurtleRecipe } from '@/shared/theme/generatedBackgrounds';
import styles from '@/shared/ui/theme/ThemeBackdrop.module.css';
import { useBackdropEnvironment } from './useBackdropEnvironment';
import { useAppearanceStore } from '@/features/settings';
import { themeRegistry } from '@/shared/theme/registry';
import { resolveAppearance } from '@/shared/theme/resolve';
import { ThemeBackdrop } from '@/shared/ui/theme/ThemeBackdrop';

/** App wiring owns the settings dependency; the shared renderer only receives data. */
export function AppearanceBackdrop() {
  const preference = useAppearanceStore((state) => state.preference);
  const { scheme, viewport } = useBackdropEnvironment();
  const clipId = `generated-${useId().replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const appearance = resolveAppearance(preference, themeRegistry, scheme);
  if (appearance.backgroundOverride.kind === 'generated') {
    return (
      <div
        aria-hidden="true"
        className={styles.backdrop}
        data-generated={appearance.backgroundOverride.presetId}
        data-running="false"
      >
        <TileTurtleBackdrop recipe={tileTurtleRecipe} scheme={appearance.scheme} geometry={{ viewport, clipId }} />
      </div>
    );
  }
  return <ThemeBackdrop background={appearance.backgroundOverride} motion={appearance.motion} />;
}
