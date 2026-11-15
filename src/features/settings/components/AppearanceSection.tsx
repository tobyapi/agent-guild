import { Segment } from '@/shared/ui';
import { setMotionPreference, useAppearanceStore } from '../appearance';
import { tAppearance as t } from '../i18n/appearance';
import { AccentPicker } from './AccentPicker';
import { ThemePicker } from './ThemePicker';
import styles from './AccentPicker.module.css';

export function AppearanceSection() {
  const motion = useAppearanceStore((state) => state.preference.motionPreference);
  return (
    <div className={styles.appearance}>
      <ThemePicker />
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
    </div>
  );
}
