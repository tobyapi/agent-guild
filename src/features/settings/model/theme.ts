// 表示のテーマ（ダーク / ライト / OS に合わせる）。この端末の表示の好みなので DB ではなく localStorage に置く。
// 既定はダーク（tokens.css）。ライトは <html data-theme="light"> で tokens-light.css が色だけ上書きする。

import type { Scheme, SchemePreference } from '@/shared/theme/types';

export type ThemePreference = SchemePreference;
export type Theme = Scheme;

export const THEME_STORAGE_KEY = 'agent-guild.theme';
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';

const THEME_PREFERENCES: readonly ThemePreference[] = ['dark', 'light', 'system'];

/** 保存されていた値（なければ・知らない値なら既定） */
export function parseThemePreference(stored: string | null): ThemePreference {
  return THEME_PREFERENCES.find((value) => value === stored) ?? DEFAULT_THEME_PREFERENCE;
}

/** 実際に使うテーマ。system なら OS の設定（ライトを好むか）に従う */
export function resolveTheme(preference: ThemePreference, systemPrefersLight: boolean): Theme {
  if (preference === 'system') return systemPrefersLight ? 'light' : 'dark';
  return preference;
}
