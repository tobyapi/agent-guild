import { useState } from 'react';
import { Segment } from '@/shared/ui';
import { setMotionPreference, useAppearanceStore } from '../appearance';
import { tAppearance as t } from '../i18n/appearance';
import { AccentPicker } from './AccentPicker';
import { ThemePicker } from './ThemePicker';
import { ThemeLibraryField } from './ThemeLibraryField';
import styles from './AccentPicker.module.css';

export function AppearanceSection() {
  const [backgroundRevision, setBackgroundRevision] = useState(0);
  const readOnly = useAppearanceStore((state) => state.readOnly);
  const motion = useAppearanceStore((state) => state.preference.motionPreference);
  return (
    <fieldset disabled={readOnly} className={styles.appearance}>
      <ThemeLibraryField onDraftClosed={() => setBackgroundRevision((value) => value + 1)} />
      <ThemePicker backgroundRevision={backgroundRevision} />
      <AccentPicker />
      <div className={styles.field}>
        <span className={styles.label} aria-hidden="true">
          {t('motionLabel')}
        </span>
        <Segment
          label={t('motionLabel')}
          value={motion}
          options={[
            { value: 'system', label: t('motionSystem') },
            { value: 'off', label: t('motionOff') },
          ]}
          onChange={setMotionPreference}
        />
      </div>
    </fieldset>
  );
}
