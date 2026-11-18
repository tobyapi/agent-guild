import { vi } from 'vitest';
import { themeRegistry } from '@/shared/theme/registry';
import type { ThemeRegistry } from '@/shared/theme/types';
import { createAppearanceStore } from './appearanceStore';

export function appearanceHarness(initial: Record<string, string> = {}, registry: ThemeRegistry = themeRegistry) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
  let listener: (() => void) | undefined;
  const query = {
    matches: false,
    addEventListener: vi.fn((_event: string, callback: unknown) => {
      listener = callback as () => void;
    }),
    removeEventListener: vi.fn(() => {
      listener = undefined;
    }),
  };
  const root = document.createElement('html');
  const environment = {
    storage: () => storage,
    warn: vi.fn<(message: string) => void>(),
    matchMedia: vi.fn(() => query),
    root: () => root,
  };
  return {
    values,
    storage,
    query,
    root,
    environment,
    controller: createAppearanceStore(environment, registry),
    changeScheme(light: boolean) {
      query.matches = light;
      listener?.();
    },
  };
}

export function storedActive(raw: string): unknown {
  return (JSON.parse(raw) as { active: unknown }).active;
}
