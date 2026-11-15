import { useSyncExternalStore } from 'react';
import { Segment } from '@/shared/ui';
import { setSchemePreference, useAppearanceStore } from '../appearance';
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
    </div>
  );
}
