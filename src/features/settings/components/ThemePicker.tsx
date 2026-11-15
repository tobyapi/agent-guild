import { useId, useSyncExternalStore, type KeyboardEvent } from 'react';
import { Segment } from '@/shared/ui';
import { themeCards } from '@/shared/theme/catalog';
import { setBackground, setSchemePreference, setGlassStyle, useAppearanceStore } from '../appearance';
import { tAppearance as t } from '../i18n/appearance';
import { ThemePreview } from './ThemePreview';
import styles from './ThemePicker.module.css';
import fields from './AccentPicker.module.css';

const backgrounds = themeCards.filter((card) => !['guild-light', 'guild-system'].includes(card.id));
const labels = {
  'guild-dark': 'backgroundNone',
  'guild-light': 'themeGuildLight',
  'guild-system': 'themeGuildSystem',
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
        ? backgrounds.length - 1
        : (index + step! + backgrounds.length) % backgrounds.length;
  setBackground(backgrounds[next]!.background);
  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
}

function subscribeScheme(callback: () => void) {
  const query = window.matchMedia?.('(prefers-color-scheme: light)');
  query?.addEventListener('change', callback);
  return () => query?.removeEventListener('change', callback);
}

function getSystemLight() {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
}

export function ThemePicker() {
  const preference = useAppearanceStore((state) => state.preference);
  const hintId = useId();
  const systemLight = useSyncExternalStore(subscribeScheme, getSystemLight, () => false);
  const scheme =
    preference.schemePreference === 'system' ? (systemLight ? 'light' : 'dark') : preference.schemePreference;
  const selected =
    backgrounds.find((card) => JSON.stringify(card.background) === JSON.stringify(preference.backgroundOverride)) ??
    backgrounds[0]!;
  return (
    <div className={fields.appearance}>
      <div className={fields.field}>
        <span className={fields.label} aria-hidden="true">
          {t('schemeLabel')}
        </span>
        <Segment
          label={t('schemeLabel')}
          value={preference.schemePreference}
          options={[
            { value: 'dark', label: t('themeGuildDark') },
            { value: 'light', label: t('themeGuildLight') },
            { value: 'system', label: t('themeGuildSystem') },
          ]}
          onChange={setSchemePreference}
        />
      </div>
      <div className={fields.field}>
        <span className={fields.label} aria-hidden="true">
          {t('backgroundLabel')}
        </span>
        <div className={styles.cards} role="radiogroup" aria-label={t('backgroundLabel')}>
          {backgrounds.map((card, index) => (
            <button
              key={card.id}
              className={styles.card}
              type="button"
              role="radio"
              aria-checked={selected.id === card.id}
              tabIndex={selected.id === card.id ? 0 : -1}
              onClick={() => setBackground(card.background)}
              onKeyDown={(event) => navigate(event, index)}
            >
              <ThemePreview card={card} scheme={scheme} />
              <span>{t(labels[card.id])}</span>
            </button>
          ))}
        </div>
      </div>
      {(['dark', 'light'] as const).map((scheme) => (
        <div className={fields.field} key={scheme}>
          <span className={fields.label} aria-hidden="true">
            {t(scheme === 'dark' ? 'glassDark' : 'glassLight')}
          </span>
          <Segment
            label={t(scheme === 'dark' ? 'glassDark' : 'glassLight')}
            value={preference.glass[scheme]}
            describedBy={preference.backgroundOverride?.kind === 'none' ? hintId : undefined}
            options={[
              { value: 'frosted', label: t('glassFrosted') },
              { value: 'liquid', label: t('glassLiquid') },
            ]}
            onChange={(style) => setGlassStyle(scheme, style)}
          />
        </div>
      ))}
      {preference.backgroundOverride?.kind === 'none' && <p id={hintId}>{t('glassInactive')}</p>}
    </div>
  );
}
