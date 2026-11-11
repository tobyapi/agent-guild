// 役割ごとの人格の書き出し例。利用者目線などは役割と独立した担当・得意分野として持つ。
import { PERSONALITIES } from './personas/personalities';
import { findPreset } from './personas/presetText';
import { TONES } from './personas/tones';
import { WORKER_PRESETS } from './presets/worker';
import { IDEATOR_PRESETS } from './presets/ideator';
import { EXPERT_PRESETS } from './presets/expert';
import { MANAGER_PRESETS } from './presets/manager';
import type { AgentPreset, PresetValues } from './presets/types';
export type { AgentPreset, PresetValues } from './presets/types';

export const AGENT_PRESETS: readonly AgentPreset[] = [
  ...WORKER_PRESETS,
  ...IDEATOR_PRESETS,
  ...EXPERT_PRESETS,
  ...MANAGER_PRESETS,
];

export function presetsFor(templateId: string | null): AgentPreset[] {
  return AGENT_PRESETS.filter((candidate) => candidate.templateId === templateId);
}

/** 人格の例の性格・口調の文面（プリセットの表から引く） */
export function presetPersona(values: PresetValues): { personality: string; tone: string } {
  return {
    personality: findPreset(PERSONALITIES, values.personality)?.text ?? '',
    tone: findPreset(TONES, values.tone)?.text ?? '',
  };
}
