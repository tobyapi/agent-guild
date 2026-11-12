import { Button, Field, SelectField, SwitchField } from '@/shared/ui';
import { t } from '../i18n';
import { SOUNDS } from '../model/preferences';
import type { SoundChoice } from '../model/preferences';
import { previewSound, setSoundPreferences, useSoundStore } from '../store';
import styles from './SoundSection.module.css';

const CHOICES: readonly SoundChoice[] = ['off', ...SOUNDS];

function choiceLabel(choice: SoundChoice): string {
  const labels: Record<SoundChoice, string> = {
    off: t('soundOff'),
    chime: t('soundChime'),
    bell: t('soundBell'),
    pop: t('soundPop'),
    wood: t('soundWood'),
  };
  return labels[choice];
}

interface SoundChoiceFieldProps {
  label: string;
  hint: string;
  value: SoundChoice;
  onChange: (choice: SoundChoice) => void;
}

/** 音の選択（なし・4つの音）と、選んだ音の試聴 */
function SoundChoiceField({ label, hint, value, onChange }: SoundChoiceFieldProps) {
  const preview =
    value === 'off' ? null : (
      <Button
        variant="link"
        size="sm"
        aria-label={t('previewLabel', { sound: choiceLabel(value) })}
        onClick={() => previewSound(value)}
      >
        {t('preview')}
      </Button>
    );
  return (
    <SelectField
      label={label}
      hint={hint}
      value={value}
      labelAction={preview}
      onChange={(next) => onChange(CHOICES.find((choice) => choice === next) ?? 'off')}
    >
      {CHOICES.map((choice) => (
        <option key={choice} value={choice}>
          {choiceLabel(choice)}
        </option>
      ))}
    </SelectField>
  );
}

/** 通知: エージェントの発言が届いたときの音（この端末だけの好み。音は Web Audio で合成する） */
export function SoundSection() {
  const preferences = useSoundStore((state) => state.preferences);
  const percent = Math.round(preferences.volume * 100);
  return (
    <div className={styles.sounds}>
      <SoundChoiceField
        label={t('mentionSound')}
        hint={t('mentionSoundHint')}
        value={preferences.mention}
        onChange={(mention) => setSoundPreferences({ mention })}
      />
      <SoundChoiceField
        label={t('messageSound')}
        hint={t('messageSoundHint')}
        value={preferences.message}
        onChange={(message) => setSoundPreferences({ message })}
      />
      <Field label={t('volume')}>
        {(control) => (
          <div className={styles.volume}>
            <input
              {...control}
              className={styles.slider}
              type="range"
              min={0}
              max={100}
              step={5}
              value={percent}
              aria-valuetext={`${percent}%`}
              onChange={(event) => setSoundPreferences({ volume: Number(event.target.value) / 100 })}
            />
            <span className={styles.volumeValue}>{percent}%</span>
          </div>
        )}
      </Field>
      <SwitchField
        label={t('onlyWhenUnfocused')}
        hint={t('onlyWhenUnfocusedHint')}
        checked={preferences.onlyWhenUnfocused}
        onChange={(onlyWhenUnfocused) => setSoundPreferences({ onlyWhenUnfocused })}
      />
    </div>
  );
}
