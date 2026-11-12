// 通知の音の好み。テーマと同じく、この端末の好みなので DB ではなく localStorage に（JSON で）置く。
// 既定: 自分宛てのメンションだけ柔らかいチャイムで鳴らし、ふつうの返信は鳴らさない。ウィンドウを見ているあいだは鳴らさない。

export const SOUNDS = ['chime', 'bell', 'pop', 'wood'] as const;
export type SoundName = (typeof SOUNDS)[number];
/** 鳴らす音（off は鳴らさない） */
export type SoundChoice = SoundName | 'off';

export interface SoundPreferences {
  /** エージェントからの発言（自分宛てのメンションを除く） */
  message: SoundChoice;
  /** 自分（人間）がメンションされた発言 */
  mention: SoundChoice;
  /** 音量 0〜1 */
  volume: number;
  /** ウィンドウを見ていない（フォーカスがない）ときだけ鳴らす */
  onlyWhenUnfocused: boolean;
}

export const SOUND_STORAGE_KEY = 'agent-guild.sounds';

export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  message: 'off',
  mention: 'chime',
  volume: 0.6,
  onlyWhenUnfocused: true,
};

const CHOICES: readonly SoundChoice[] = ['off', ...SOUNDS];

function parseChoice(value: unknown, fallback: SoundChoice): SoundChoice {
  return CHOICES.find((choice) => choice === value) ?? fallback;
}

function parseVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SOUND_PREFERENCES.volume;
  return Math.min(1, Math.max(0, value));
}

function parseObject(stored: string | null): Record<string, unknown> {
  if (stored === null) return {};
  try {
    const value: unknown = JSON.parse(stored);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** 保存されていた値（壊れている・知らない値の項目は既定。足りない項目も既定で補う） */
export function parseSoundPreferences(stored: string | null): SoundPreferences {
  const raw = parseObject(stored);
  const defaults = DEFAULT_SOUND_PREFERENCES;
  return {
    message: parseChoice(raw.message, defaults.message),
    mention: parseChoice(raw.mention, defaults.mention),
    volume: parseVolume(raw.volume),
    onlyWhenUnfocused: typeof raw.onlyWhenUnfocused === 'boolean' ? raw.onlyWhenUnfocused : defaults.onlyWhenUnfocused,
  };
}

export function serializeSoundPreferences(preferences: SoundPreferences): string {
  return JSON.stringify(preferences);
}
