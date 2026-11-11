import type { AgentInput, AgentTemplate } from '@/shared/types/domain';
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

export const preset = (id: string, templateId: string, title: string, values: PresetValues): AgentPreset => ({
  id,
  templateId,
  title,
  values,
});
