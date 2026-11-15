import { Segment, SelectField } from '@/shared/ui';
import type { BackgroundSpec } from '@/shared/theme/types';
import { setBackground, setMotionPreference, useAppearanceStore } from '../appearance';
import { tAppearance as t } from '../i18n/appearance';
import styles from './AccentPicker.module.css';

const choices: ReadonlyArray<{
  value: string;
  label: 'backgroundDefault' | 'backgroundNone' | 'backgroundDawn' | 'backgroundNight' | 'backgroundAurora';
  background: BackgroundSpec | null;
}> = [
  { value: 'default', label: 'backgroundDefault', background: null },
  { value: 'none', label: 'backgroundNone', background: { kind: 'none' } },
  { value: 'dawn', label: 'backgroundDawn', background: { kind: 'image', assetId: 'dawn' } },
  { value: 'night', label: 'backgroundNight', background: { kind: 'image', assetId: 'night' } },
  { value: 'aurora', label: 'backgroundAurora', background: { kind: 'scene', sceneId: 'aurora' } },
];

export function BackgroundPicker() {
  const preference = useAppearanceStore((state) => state.preference);
  const background = preference.backgroundOverride;
  const value =
    background === null
      ? 'default'
      : background.kind === 'image'
        ? background.assetId
        : background.kind === 'scene'
          ? background.sceneId
          : 'none';
  return (
    <>
      <SelectField
        label={t('backgroundLabel')}
        value={value}
        onChange={(next) => setBackground(choices.find((choice) => choice.value === next)?.background ?? null)}
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {t(choice.label)}
          </option>
        ))}
      </SelectField>
      <div className={styles.field}>
        <span className={styles.label} aria-hidden="true">
          {t('motionLabel')}
        </span>
        <Segment
          label={t('motionLabel')}
          value={preference.motionPreference}
          options={[
            { value: 'system', label: t('motionSystem') },
            { value: 'off', label: t('motionOff') },
          ]}
          onChange={setMotionPreference}
        />
      </div>
    </>
  );
}
