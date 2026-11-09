import { describe, expect, it } from 'vitest';
import { parseThemePreference, resolveTheme } from './theme';

describe('parseThemePreference', () => {
  it('保存されていた値を読み、なければ・知らない値なら既定（ダーク）にする', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('system')).toBe('system');
    expect(parseThemePreference(null)).toBe('dark');
    expect(parseThemePreference('sepia')).toBe('dark');
  });
});

describe('resolveTheme', () => {
  it('OS に合わせるときだけ OS の設定を見る', () => {
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('light', false)).toBe('light');
  });
});
