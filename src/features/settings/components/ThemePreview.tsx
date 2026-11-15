import { useId } from 'react';
import type { Scheme } from '@/shared/theme/types';
import type { ThemeCard } from '@/shared/theme/catalog';
import { tileTurtleRecipe } from '@/shared/theme/generatedBackgrounds';
import { TileTurtleBackdrop } from '@/shared/ui/theme/TileTurtleBackdrop';
import styles from './ThemePicker.module.css';

/** Always static: opening settings must not start seven backdrop animations. */
export function ThemePreview({ card, scheme = 'dark' }: { card: ThemeCard; scheme?: Scheme }) {
  const clipId = `preview-${useId().replace(/[^A-Za-z0-9_-]/g, '-')}`;
  return (
    <span aria-hidden="true" className={styles.preview} data-art={card.id} data-scheme={scheme}>
      {card.background.kind === 'generated' && (
        <TileTurtleBackdrop recipe={tileTurtleRecipe} scheme={scheme} geometry={{ viewport: [180, 100], clipId }} />
      )}
      <span className={styles.sample} />
    </span>
  );
}
