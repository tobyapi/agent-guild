// 表示のテーマ（ダーク / ライト / OS に合わせる）。この端末の表示の好みなので DB ではなく localStorage に置く。
// 既定はダーク（tokens.css）。ライトは <html data-theme="light"> で tokens-light.css が色だけ上書きする。

import { t } from '../i18n';

export type ThemePreference = 'dark' | 'light' | 'system';
export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'agent-guild.theme';
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';

const THEME_PREFERENCES: readonly ThemePreference[] = ['dark', 'light', 'system'];

/** テーマの選択肢（いまの言語で描画のたびに作る） */
export function themeChoices(): ReadonlyArray<{ value: ThemePreference; label: string }> {
  const labels = { dark: t('themeDark'), light: t('themeLight'), system: t('themeSystem') };
  return THEME_PREFERENCES.map((value) => ({ value, label: labels[value] }));
}

/** 保存されていた値（なければ・知らない値なら既定） */
export function parseThemePreference(stored: string | null): ThemePreference {
  return THEME_PREFERENCES.find((value) => value === stored) ?? DEFAULT_THEME_PREFERENCE;
}

/** 実際に使うテーマ。system なら OS の設定（ライトを好むか）に従う */
export function resolveTheme(preference: ThemePreference, systemPrefersLight: boolean): Theme {
  if (preference === 'system') return systemPrefersLight ? 'light' : 'dark';
  return preference;
}
