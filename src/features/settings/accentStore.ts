// アクセントの色の好みの保持と反映（<html data-accent>）。保存先は localStorage（使えない環境では保存せずに反映だけする）。
import { create } from 'zustand';
import { ACCENT_STORAGE_KEY, DEFAULT_ACCENT, parseAccent } from './model/accent';
import type { Accent } from './model/accent';

export const useAccentStore = create<{ accent: Accent }>()(() => ({
  accent: parseAccent(readStored()),
}));

function readStored(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(ACCENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function apply(accent: Accent): void {
  if (typeof document === 'undefined') return;
  // 既定は属性を付けない（tokens.css の値そのまま）
  if (accent === DEFAULT_ACCENT) delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = accent;
}

/** 起動時に1回（最初の描画の前）: 保存されていたアクセントの色を反映する */
export function initAccent(): void {
  apply(useAccentStore.getState().accent);
}

export function setAccent(accent: Accent): void {
  useAccentStore.setState({ accent });
  apply(accent);
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // 保存できなくても、この起動のあいだは反映されている
  }
}
