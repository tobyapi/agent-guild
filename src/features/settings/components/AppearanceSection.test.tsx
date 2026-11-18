// @vitest-environment jsdom
import { storedActive } from '../appearance.test-support';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { defaultAppearance } from '@/shared/theme/registry';
import { initAppearance } from '../appearance';
import { ACCENT_STORAGE_KEY } from '../model/accent';
import { APPEARANCE_STORAGE_KEY } from '../model/appearance';
import { LIBRARY_KEY } from '../themeLibrary';
import { THEME_STORAGE_KEY } from '../model/theme';
import { AppearanceSection } from './AppearanceSection';

let stopAppearance: () => void;
let values: Map<string, string>;
let query: EventTarget & { matches: boolean };

beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  query = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query),
  );
  stopAppearance = initAppearance();
});

afterEach(() => {
  cleanup();
  stopAppearance();
  vi.unstubAllGlobals();
  for (const attribute of [
    'data-theme',
    'data-theme-id',
    'data-accent',
    'data-background',
    'data-background-source',
    'data-glass',
  ]) {
    document.documentElement.removeAttribute(attribute);
  }
});

it('明るさ・背景を保存し、ガラス設定を表示せず再起動後に保持する', () => {
  render(<AppearanceSection />);
  const group = screen.getByRole('radiogroup', { name: '背景' });
  expect([...group.querySelectorAll('[role="radio"]')].map((button) => button.textContent)).toEqual(['なし']);
  expect(screen.queryByRole('radiogroup', { name: /ガラス/ })).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: '空' }));
  fireEvent.click(screen.getByRole('radio', { name: '停止' }));
  expect(document.documentElement.dataset).toMatchObject({
    theme: 'dark',
    glass: 'none',
  });
  cleanup();
  stopAppearance();
  stopAppearance = initAppearance();
  render(<AppearanceSection />);
  expect(screen.getByRole('radio', { name: 'なし' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.keyDown(screen.getByRole('radio', { name: 'なし' }), { key: 'ArrowDown' });
  expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'なし' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  fireEvent.keyDown(document.activeElement!, { key: 'End' });
  expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'なし' }));
  fireEvent.keyDown(document.activeElement!, { key: 'Home' });
  expect(document.documentElement.dataset.glass).toBe('none');
  expect(storedActive(values.get(LIBRARY_KEY)!)).not.toHaveProperty('glass');
  expect(storedActive(values.get(LIBRARY_KEY)!)).toMatchObject({
    schemePreference: 'dark',
    backgroundOverride: { kind: 'none' },
    accentOverride: 'sky',
    motionPreference: 'off',
  });
});

it('アクセントの色の見本を選ぶと <html data-accent> に反映し、既定に戻すと属性を外す', () => {
  render(<AppearanceSection />);
  const group = screen.getByRole('radiogroup', { name: 'アクセントの色' });
  expect(group.querySelectorAll('[role="radio"]')).toHaveLength(7);
  expect(screen.getByRole('radio', { name: '灯の金（既定）' }).getAttribute('aria-checked')).toBe('true');

  fireEvent.click(screen.getByRole('radio', { name: '空' }));
  expect(document.documentElement.dataset.accent).toBe('sky');
  expect(screen.getByRole('radio', { name: '空' }).getAttribute('aria-checked')).toBe('true');

  fireEvent.keyDown(screen.getByRole('radio', { name: '空' }), { key: 'ArrowRight' });
  expect(document.documentElement.dataset.accent).toBe('violet');

  fireEvent.click(screen.getByRole('radio', { name: '灯の金（既定）' }));
  expect(document.documentElement.dataset.accent).toBeUndefined();
});

it('初回描画前に旧保存値を移し、設定画面とDOMに同じ選択を反映する', () => {
  stopAppearance();
  values.clear();
  values.set(THEME_STORAGE_KEY, 'light');
  values.set(ACCENT_STORAGE_KEY, 'sky');
  stopAppearance = initAppearance();
  expect(document.documentElement.dataset).toMatchObject({ theme: 'light', themeId: 'guild', accent: 'sky' });
  render(<AppearanceSection />);
  expect(screen.getByRole('radio', { name: 'ギルド ライト' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByRole('radio', { name: '空' }).getAttribute('aria-checked')).toBe('true');
  expect(storedActive(values.get(LIBRARY_KEY)!)).toMatchObject({
    schemePreference: 'light',
    accentOverride: 'sky',
  });
});

it('明暗とアクセントを相互に保持してv2に保存し、再起動後もUIを復元する', () => {
  stopAppearance();
  const preference = { ...defaultAppearance(), motionPreference: 'off', backgroundOverride: { kind: 'none' } };
  values.delete(LIBRARY_KEY);
  values.set(APPEARANCE_STORAGE_KEY, JSON.stringify(preference));
  stopAppearance = initAppearance();
  render(<AppearanceSection />);
  fireEvent.click(screen.getByRole('radio', { name: '空' }));
  fireEvent.click(screen.getByRole('radio', { name: 'ギルド ライト' }));
  expect(document.documentElement.dataset).toMatchObject({ theme: 'light', accent: 'sky' });
  expect(document.documentElement.hasAttribute('style')).toBe(false);
  expect(storedActive(values.get(LIBRARY_KEY)!)).toEqual({
    ...preference,
    schemePreference: 'light',
    accentOverride: 'sky',
  });
  expect(values.get(THEME_STORAGE_KEY)).toBeUndefined();
  expect(values.get(ACCENT_STORAGE_KEY)).toBeUndefined();
  cleanup();
  stopAppearance();
  stopAppearance = initAppearance();
  render(<AppearanceSection />);
  expect(screen.getByRole('radio', { name: 'ギルド ライト' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByRole('radio', { name: '空' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('radio', { name: '灯の金（既定）' }));
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(storedActive(values.get(LIBRARY_KEY)!)).toMatchObject({ accentOverride: null });
  expect(values.get(ACCENT_STORAGE_KEY)).toBeUndefined();
});

it('OSに合わせる選択でOSの変更に追従し、明示選択は保持する', () => {
  render(<AppearanceSection />);
  fireEvent.click(screen.getByRole('radio', { name: 'システムに合わせる' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  query.matches = true;
  query.dispatchEvent(new Event('change'));
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(values.get(THEME_STORAGE_KEY)).toBeUndefined();
  expect(screen.getByRole('radio', { name: 'システムに合わせる' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('radio', { name: 'ギルド ダーク' }));
  query.dispatchEvent(new Event('change'));
  expect(document.documentElement.dataset.theme).toBe('dark');
});
