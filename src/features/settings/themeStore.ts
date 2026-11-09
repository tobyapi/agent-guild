// テーマの好みの保持と反映（<html data-theme>）。保存先は localStorage（使えない環境では保存せずに反映だけする）。
import { create } from 'zustand';
import { parseThemePreference, resolveTheme, THEME_STORAGE_KEY } from './model/theme';
import type { ThemePreference } from './model/theme';

const LIGHT_QUERY = '(prefers-color-scheme: light)';

export const useThemeStore = create<{ preference: ThemePreference }>()(() => ({
  preference: parseThemePreference(readStored()),
}));

function readStored(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function systemPrefersLight(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(LIGHT_QUERY).matches;
}

function apply(preference: ThemePreference): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolveTheme(preference, systemPrefersLight());
}

/** 起動時に1回: 保存されていたテーマを反映し、「OS に合わせる」なら OS の切り替えにも追従する */
export function initTheme(): void {
  apply(useThemeStore.getState().preference);
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  window.matchMedia(LIGHT_QUERY).addEventListener('change', () => {
    const { preference } = useThemeStore.getState();
    if (preference === 'system') apply(preference);
  });
}

export function setThemePreference(preference: ThemePreference): void {
  useThemeStore.setState({ preference });
  apply(preference);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // 保存できなくても、この起動のあいだは反映されている
  }
}
