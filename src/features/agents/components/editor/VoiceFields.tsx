import { migrateStoredVoiceMode } from '@/shared/lib/voice';
import { SelectField } from '@/shared/ui';
import type { VoiceSettings } from '@/shared/types/domain';
import { tVoice } from '../../i18n/voice';

export function VoiceFields({ value, onChange }: { value: VoiceSettings; onChange: (value: VoiceSettings) => void }) {
  const selection = migrateStoredVoiceMode(value.mode);
  return (
    <>
      <SelectField
        label={tVoice('label')}
        hint={tVoice('hint')}
        value={selection}
        onChange={(mode) => onChange({ ...value, mode })}
      >
        <option value="auto">{tVoice('auto')}</option>
        <option value="off">{tVoice('off')}</option>
      </SelectField>
      {selection !== 'off' && (
        <SelectField
          label={tVoice('intensity')}
          value={value.intensity}
          onChange={(intensity) => onChange({ ...value, intensity: intensity as VoiceSettings['intensity'] })}
        >
          <option value="weak">{tVoice('weak')}</option>
          <option value="medium">{tVoice('medium')}</option>
          <option value="strong">{tVoice('strong')}</option>
        </SelectField>
      )}
    </>
  );
}
