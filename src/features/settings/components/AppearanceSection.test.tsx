// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { defaultAppearance } from '@/shared/theme/registry';
import { initAppearance } from '../appearance';
import { ACCENT_STORAGE_KEY } from '../model/accent';
import { APPEARANCE_STORAGE_KEY } from '../model/appearance';
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
  for (const attribute of ['data-theme', 'data-theme-id', 'data-accent', 'data-background', 'data-background-source']) {
    document.documentElement.removeAttribute(attribute);
  }
});

it('7枚のテーマカードで背景と明暗を保存し、アクセントと動きも再起動後に保持する', () => {
  render(<AppearanceSection />);
  expect(screen.queryByRole('combobox', { name: '背景' })).toBeNull();
  const group = screen.getByRole('radiogroup', { name: 'テーマ' });
  expect(group.querySelectorAll('[role="radio"]')).toHaveLength(7);
  expect(group.querySelectorAll('[data-art]')).toHaveLength(7);
  fireEvent.click(screen.getByRole('radio', { name: 'ウミガメ' }));
  fireEvent.click(screen.getByRole('radio', { name: '空' }));
  fireEvent.click(screen.getByRole('radio', { name: '停止' }));
  expect(document.documentElement.dataset).toMatchObject({
    theme: 'light',
    themeId: 'turtle',
    backgroundSource: 'generated',
  });
  expect(JSON.parse(values.get(APPEARANCE_STORAGE_KEY)!)).toMatchObject({
    themeId: 'turtle',
    schemePreference: 'light',
    backgroundOverride: null,
    accentOverride: 'sky',
    motionPreference: 'off',
  });
  cleanup();
  stopAppearance();
  stopAppearance = initAppearance();
  render(<AppearanceSection />);
  expect(screen.getByRole('radio', { name: 'ウミガメ' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByRole('radio', { name: '停止' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.keyDown(screen.getByRole('radio', { name: 'ウミガメ' }), { key: 'ArrowDown' });
  expect(document.activeElement).toBe(screen.getByRole('radio', { name: '朝の丘' }));
  expect(document.documentElement.dataset).toMatchObject({
    theme: 'light',
    themeId: 'dawn',
    backgroundSource: 'image',
  });
  fireEvent.keyDown(document.activeElement!, { key: 'End' });
  expect(document.documentElement.dataset).toMatchObject({
    theme: 'dark',
    themeId: 'aurora',
    backgroundSource: 'scene',
  });
  fireEvent.keyDown(document.activeElement!, { key: 'Home' });
  expect(document.documentElement.dataset.background).toBeUndefined();
  expect(document.documentElement.dataset.backgroundSource).toBeUndefined();
  expect(JSON.parse(values.get(APPEARANCE_STORAGE_KEY)!)).toMatchObject({
    themeId: 'guild',
    schemePreference: 'dark',
    backgroundOverride: null,
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
  expect(JSON.parse(values.get(APPEARANCE_STORAGE_KEY)!)).toMatchObject({
    schemePreference: 'light',
    accentOverride: 'sky',
  });
});

it('明暗とアクセントを相互に保持して新旧に保存し、再起動後もUIを復元する', () => {
  stopAppearance();
  const preference = { ...defaultAppearance(), motionPreference: 'off', backgroundOverride: null };
  values.set(APPEARANCE_STORAGE_KEY, JSON.stringify(preference));
  stopAppearance = initAppearance();
  render(<AppearanceSection />);
  fireEvent.click(screen.getByRole('radio', { name: '空' }));
  fireEvent.click(screen.getByRole('radio', { name: 'ギルド ライト' }));
  expect(document.documentElement.dataset).toMatchObject({ theme: 'light', accent: 'sky' });
  expect(document.documentElement.hasAttribute('style')).toBe(false);
  expect(JSON.parse(values.get(APPEARANCE_STORAGE_KEY)!)).toEqual({
    ...preference,
    schemePreference: 'light',
    accentOverride: 'sky',
  });
  expect(values.get(THEME_STORAGE_KEY)).toBe('light');
  expect(values.get(ACCENT_STORAGE_KEY)).toBe('sky');
  cleanup();
  stopAppearance();
  stopAppearance = initAppearance();
  render(<AppearanceSection />);
  expect(screen.getByRole('radio', { name: 'ギルド ライト' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByRole('radio', { name: '空' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('radio', { name: '灯の金（既定）' }));
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(JSON.parse(values.get(APPEARANCE_STORAGE_KEY)!)).toMatchObject({ accentOverride: null });
  expect(values.get(ACCENT_STORAGE_KEY)).toBe('default');
});

it('OSに合わせる選択でOSの変更に追従し、明示選択は保持する', () => {
  render(<AppearanceSection />);
  fireEvent.click(screen.getByRole('radio', { name: 'システムに合わせる' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  query.matches = true;
  query.dispatchEvent(new Event('change'));
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(values.get(THEME_STORAGE_KEY)).toBe('system');
  expect(screen.getByRole('radio', { name: 'システムに合わせる' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('radio', { name: 'ギルド ダーク' }));
  query.dispatchEvent(new Event('change'));
  expect(document.documentElement.dataset.theme).toBe('dark');
});
