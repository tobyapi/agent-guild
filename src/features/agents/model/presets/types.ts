import type { AgentInput, AgentTemplate } from '@/shared/types/domain';
import { tPreset } from '../../i18n/presets';
import type { AgentPresetId } from '../../i18n/presets';
import type { PersonalityId } from '../personas/personalities';
import type { ToneId } from '../personas/tones';

export interface PresetValues extends Pick<AgentInput, 'name' | 'avatar' | 'color' | 'role' | 'expertise'> {
  personality: PersonalityId;
  tone: ToneId;
}

export interface AgentPreset {
  id: string;
  templateId: AgentTemplate['id'];
  title: string;
  values: PresetValues;
}

/** 表に置く形。題・名前・担当・得意分野は翻訳表（i18n/presets。キーは「id.項目」）から引く */
export interface PresetEntry {
  id: AgentPresetId;
  templateId: AgentTemplate['id'];
  values: Omit<PresetValues, 'name' | 'role' | 'expertise'>;
}

export const preset = (id: AgentPresetId, templateId: string, values: PresetEntry['values']): PresetEntry => ({
  id,
  templateId,
  values,
});

/** いまの言語の題・名前・担当・得意分野を入れる */
export function localizePreset({ id, templateId, values }: PresetEntry): AgentPreset {
  return {
    id,
    templateId,
    title: tPreset(`${id}.title`),
    values: {
      ...values,
      name: tPreset(`${id}.name`),
      role: tPreset(`${id}.role`),
      expertise: tPreset(`${id}.expertise`),
    },
  };
}
