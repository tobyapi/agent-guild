import type { Scheme } from '@/shared/theme/types';
import type { ThemeCard } from '@/shared/theme/catalog';
import styles from './ThemePicker.module.css';

/** Always static: opening settings must not start backdrop animations. */
export function ThemePreview({ card, scheme = 'dark' }: { card: ThemeCard; scheme?: Scheme }) {
  return (
    <span aria-hidden="true" className={styles.preview} data-art={card.id} data-scheme={scheme}>
      <span className={styles.sample} />
    </span>
  );
}
