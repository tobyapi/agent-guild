import type { KeyboardEvent } from 'react';
import { selectedThemeCard, themeCards } from '@/shared/theme/catalog';
import { setThemeCard, useAppearanceStore } from '../appearance';
import { tAppearance as t } from '../i18n/appearance';
import { ThemePreview } from './ThemePreview';
import styles from './ThemePicker.module.css';

const labels = {
  'guild-dark': 'themeGuildDark',
  'guild-light': 'themeGuildLight',
  'guild-system': 'themeGuildSystem',
  turtle: 'themeTurtle',
  dawn: 'themeDawn',
  night: 'themeNight',
  aurora: 'themeAurora',
} as const;

function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
  const steps: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
  const step = steps[event.key];
  if (step === undefined && event.key !== 'Home' && event.key !== 'End') return;
  event.preventDefault();
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? themeCards.length - 1
        : (index + step! + themeCards.length) % themeCards.length;
  setThemeCard(themeCards[next]!);
  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
}

export function ThemePicker() {
  const preference = useAppearanceStore((state) => state.preference);
  const selected = selectedThemeCard(preference);
  return (
    <div className={styles.cards} role="radiogroup" aria-label={t('themeLabel')}>
      {themeCards.map((card, index) => (
        <button
          key={card.id}
          className={styles.card}
          type="button"
          role="radio"
          aria-checked={selected.id === card.id}
          tabIndex={selected.id === card.id ? 0 : -1}
          onClick={() => setThemeCard(card)}
          onKeyDown={(event) => navigate(event, index)}
        >
          <ThemePreview card={card} />
          <span>{t(labels[card.id])}</span>
        </button>
      ))}
    </div>
  );
}
