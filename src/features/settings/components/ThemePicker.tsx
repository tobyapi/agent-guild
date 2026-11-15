import { useId, useSyncExternalStore } from 'react';
import { Segment } from '@/shared/ui';
import { setSchemePreference, setGlassStyle, useAppearanceStore } from '../appearance';
import { tAppearance as t } from '../i18n/appearance';
import { BackgroundPicker } from './BackgroundPicker';
import fields from './AccentPicker.module.css';

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
      <BackgroundPicker scheme={scheme} />
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
