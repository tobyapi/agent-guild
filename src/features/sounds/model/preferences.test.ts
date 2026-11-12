import { describe, expect, it } from 'vitest';
import { DEFAULT_SOUND_PREFERENCES, parseSoundPreferences, serializeSoundPreferences } from './preferences';

describe('parseSoundPreferences', () => {
  it('保存がなければ既定（自分宛てだけチャイム・見ていないときだけ）', () => {
    expect(parseSoundPreferences(null)).toEqual(DEFAULT_SOUND_PREFERENCES);
    expect(DEFAULT_SOUND_PREFERENCES).toMatchObject({ message: 'off', mention: 'chime', onlyWhenUnfocused: true });
  });

  it('保存した値を往復できる', () => {
    const preferences = { message: 'pop', mention: 'bell', volume: 0.25, onlyWhenUnfocused: false } as const;
    expect(parseSoundPreferences(serializeSoundPreferences(preferences))).toEqual(preferences);
  });

  it('壊れた JSON・JSON でない形は既定にする', () => {
    expect(parseSoundPreferences('{')).toEqual(DEFAULT_SOUND_PREFERENCES);
    expect(parseSoundPreferences('[1,2]')).toEqual(DEFAULT_SOUND_PREFERENCES);
    expect(parseSoundPreferences('"chime"')).toEqual(DEFAULT_SOUND_PREFERENCES);
  });

  it('項目ごとに、知らない値・足りない項目は既定で補い、音量は 0〜1 に収める', () => {
    const parsed = parseSoundPreferences(JSON.stringify({ message: 'trumpet', mention: 'off', volume: 3 }));
    expect(parsed).toEqual({ message: 'off', mention: 'off', volume: 1, onlyWhenUnfocused: true });
    expect(parseSoundPreferences(JSON.stringify({ volume: -1 })).volume).toBe(0);
    expect(parseSoundPreferences(JSON.stringify({ volume: 'loud', onlyWhenUnfocused: 'yes' }))).toEqual(
      DEFAULT_SOUND_PREFERENCES,
    );
  });
});
