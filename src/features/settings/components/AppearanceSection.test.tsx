// @vitest-environment jsdom
import { storedActive, storedLibrary } from '../appearance.test-support';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { defaultAppearance } from '@/shared/theme/registry';
import { initAppearance } from '../appearance';
import { LIBRARY_KEY } from '../themeLibrary';
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
  const mascot = screen.getByRole('switch', { name: 'マスコットを表示する', checked: true });
  expect(screen.getByRole('button', { name: 'マスコットを選ぶ' })).toBeTruthy();
  fireEvent.click(mascot);
  expect(screen.getByRole('button', { name: 'マスコットを選ぶ' })).toBeTruthy();
  expect(screen.queryByRole('slider', { name: '横の位置' })).toBeNull();
  expect(screen.queryByRole('radiogroup', { name: /ガラス/ })).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: '空' }));
  expect(screen.queryByRole('radiogroup', { name: '背景の動き' })).toBeNull();
  expect(document.documentElement.dataset).toMatchObject({
    theme: 'dark',
    glass: 'none',
  });
  cleanup();
  stopAppearance();
  stopAppearance = initAppearance();
  render(<AppearanceSection />);
  expect(screen.getByRole('radio', { name: 'なし' }).getAttribute('aria-checked')).toBe('true');
  const restoredMascot = screen.getByRole('switch', { name: 'マスコットを表示する', checked: false });
  fireEvent.click(restoredMascot);
  expect(screen.getByRole('button', { name: 'マスコットを選ぶ' })).toBeTruthy();
  expect(document.documentElement.dataset.glass).toBe('none');
  expect(storedActive(values.get(LIBRARY_KEY)!)).not.toHaveProperty('glass');
  expect(storedActive(values.get(LIBRARY_KEY)!)).toMatchObject({
    schemePreference: 'dark',
    backgroundOverride: { kind: 'none' },
    accentOverride: 'sky',
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

it('初回描画前に保存済みのv3を読み込み、設定画面とDOMに同じ選択を反映する', () => {
  stopAppearance();
  values.clear();
  values.set(LIBRARY_KEY, storedLibrary({ ...defaultAppearance(), schemePreference: 'light', accentOverride: 'sky' }));
  stopAppearance = initAppearance();
  expect(document.documentElement.dataset).toMatchObject({ theme: 'light', themeId: 'guild', accent: 'sky' });
  render(<AppearanceSection />);
  expect(screen.getByRole('radio', { name: 'ライト' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByRole('radio', { name: '空' }).getAttribute('aria-checked')).toBe('true');
  expect(storedActive(values.get(LIBRARY_KEY)!)).toMatchObject({
    schemePreference: 'light',
    accentOverride: 'sky',
  });
});

it('明暗とアクセントを相互に保持してv3に保存し、再起動後もUIを復元する', () => {
  stopAppearance();
  const preference = { ...defaultAppearance(), backgroundOverride: { kind: 'none' } };
  values.delete(LIBRARY_KEY);
  values.set(LIBRARY_KEY, storedLibrary(preference));
  stopAppearance = initAppearance();
  render(<AppearanceSection />);
  fireEvent.click(screen.getByRole('radio', { name: '空' }));
  fireEvent.click(screen.getByRole('radio', { name: 'ライト' }));
  expect(document.documentElement.dataset).toMatchObject({ theme: 'light', accent: 'sky' });
  expect(document.documentElement.hasAttribute('style')).toBe(false);
  expect(storedActive(values.get(LIBRARY_KEY)!)).toEqual({
    ...preference,
    schemePreference: 'light',
    accentOverride: 'sky',
  });
  cleanup();
  stopAppearance();
  stopAppearance = initAppearance();
  render(<AppearanceSection />);
  expect(screen.getByRole('radio', { name: 'ライト' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByRole('radio', { name: '空' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('radio', { name: '灯の金（既定）' }));
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(storedActive(values.get(LIBRARY_KEY)!)).toMatchObject({ accentOverride: null });
});

it('OSに合わせる選択でOSの変更に追従し、明示選択は保持する', () => {
  render(<AppearanceSection />);
  const dark = screen.getByRole('radio', { name: 'ダーク', checked: true });
  const system = screen.getByRole('radio', { name: 'システムに合わせる', checked: false });
  fireEvent.keyDown(dark, { key: 'ArrowLeft' });
  expect(document.activeElement).toBe(system);
  expect(dark.getAttribute('aria-checked')).toBe('false');
  expect(document.documentElement.dataset.theme).toBe('dark');
  query.matches = true;
  query.dispatchEvent(new Event('change'));
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(screen.getByRole('radio', { name: 'システムに合わせる' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(dark);
  expect(system.getAttribute('aria-checked')).toBe('false');
  query.dispatchEvent(new Event('change'));
  expect(document.documentElement.dataset.theme).toBe('dark');
});

it('notifies and disables appearance changes when a newer library is present', () => {
  stopAppearance();
  const future = '{"version":4,"themes":[],"future":"keep"}';
  values.set(LIBRARY_KEY, future);
  stopAppearance = initAppearance();
  render(<AppearanceSection />);
  expect(screen.getByRole('alert').textContent).toContain('読み取り専用');
  const create = screen.getByRole<HTMLButtonElement>('button', { name: 'テーマを作る' });
  expect(create.matches(':disabled')).toBe(true);
  expect(values.get(LIBRARY_KEY)).toBe(future);
});
