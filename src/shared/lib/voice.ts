import catalog from '@/shared/assets/skills/character-voice/references/catalog.json';
import type { VoiceSettings } from '@/shared/types/domain';

export const VOICE_MODES = catalog.modes;
export const DEFAULT_VOICE: Readonly<VoiceSettings> = { mode: 'auto', intensity: 'weak' };

/** 編集画面で選べる保存値。旧値は読み込み側で自動へ移す。 */
export function resolveVoiceMode(value: string): string | null {
  const key = value.normalize('NFKC').trim().toLowerCase();
  if (['auto', '自動'].includes(key)) return 'auto';
  if (['off', '通常', 'いつもの口調'].includes(key)) return 'off';
  return null;
}

export function migrateStoredVoiceMode(value: string): 'auto' | 'off' {
  return resolveVoiceMode(value) === 'off' ? 'off' : 'auto';
}
