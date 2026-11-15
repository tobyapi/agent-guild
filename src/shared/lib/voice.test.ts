import { describe, expect, it } from 'vitest';
import cases from '../../../contracts/behavior/voice.json';
import { DEFAULT_VOICE, migrateStoredVoiceMode, resolveVoiceMode, VOICE_MODES } from './voice';

describe('会話文体の選択', () => {
  it.each(cases)('$input を $expected に解決する', ({ input, expected }) => {
    expect(resolveVoiceMode(input)).toBe(expected);
  });
  it('内部IDと文体名では選択できず、旧保存値は自動へ移る', () => {
    expect(VOICE_MODES).toHaveLength(27);
    for (const mode of VOICE_MODES) {
      for (const key of [mode.id, mode.title, ...mode.aliases]) {
        expect(resolveVoiceMode(key)).toBeNull();
        expect(migrateStoredVoiceMode(key)).toBe('auto');
      }
    }
    expect(migrateStoredVoiceMode('off')).toBe('off');
    expect(DEFAULT_VOICE).toEqual({ mode: 'auto', intensity: 'weak' });
  });
});
