// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { defaultAppearance, safeAppearance } from '@/shared/theme/registry';
import { appearanceHarness } from './appearance.test-support';
import { createAppearanceStore } from './appearanceStore';
import { APPEARANCE_STORAGE_KEY as KEY } from './model/appearance';
import { ACCENT_STORAGE_KEY as ACCENT } from './model/accent';
import { THEME_STORAGE_KEY as THEME } from './model/theme';

describe('appearance lifecycle', () => {
  it('has no import/construction side effects', () => {
    const h = appearanceHarness();
    expect(h.storage.getItem).not.toHaveBeenCalled();
    expect(h.storage.setItem).not.toHaveBeenCalled();
    expect(h.environment.matchMedia).not.toHaveBeenCalled();
    expect(h.root.attributes).toHaveLength(0);
  });

  it('updates memory, attributes and v2 storage only, removing the default accent attribute', () => {
    const h = appearanceHarness();
    h.controller.init();
    const preference = { ...defaultAppearance(), schemePreference: 'light' as const, accentOverride: 'sky' as const };
    h.controller.setPreference(preference);
    expect(h.controller.store.getState().preference).toEqual(preference);
    expect(h.root.dataset).toMatchObject({ theme: 'light', themeId: 'guild', accent: 'sky' });
    expect(JSON.parse(h.values.get(KEY)!)).toEqual(preference);
    expect(h.values.get(THEME)).toBeUndefined();
    expect(h.values.get(ACCENT)).toBeUndefined();
    h.controller.setPreference(defaultAppearance());
    expect(h.root.hasAttribute('data-accent')).toBe(false);
    expect(h.root.hasAttribute('style')).toBe(false);
  });

  it('registers one listener, follows OS only for system, and removes the listener on disposal', () => {
    const h = appearanceHarness({ [THEME]: 'system' });
    h.controller.init();
    h.controller.init();
    h.changeScheme(true);
    expect(h.root.dataset.theme).toBe('light');
    h.changeScheme(false);
    expect(h.root.dataset.theme).toBe('dark');
    h.controller.setPreference({ ...defaultAppearance(), schemePreference: 'light' });
    h.changeScheme(false);
    expect(h.root.dataset.theme).toBe('light');
    expect(h.query.addEventListener).toHaveBeenCalledTimes(1);
    h.controller.dispose();
    expect(h.query.removeEventListener).toHaveBeenCalledTimes(1);
    h.controller.init();
    expect(h.query.addEventListener).toHaveBeenCalledTimes(2);
  });

  it('tracks legacy background sources and clears stale source attributes for none', () => {
    const h = appearanceHarness();
    h.controller.init();
    h.controller.setPreference({
      ...defaultAppearance(),
      backgroundOverride: { kind: 'generated', presetId: 'tile-turtle' },
    });
    expect(h.root.hasAttribute('data-background')).toBe(false);
    expect(JSON.parse(h.values.get(KEY)!)).toMatchObject({
      backgroundOverride: { kind: 'generated', presetId: 'tile-turtle' },
    });
    h.controller.dispose();
    h.controller.init();
    expect(h.controller.store.getState().preference.backgroundOverride).toEqual({ kind: 'none' });
    h.controller.setPreference({ ...defaultAppearance(), backgroundOverride: { kind: 'image', assetId: 'dawn' } });
    expect(h.root.hasAttribute('data-background')).toBe(false);
    h.controller.setPreference({ ...defaultAppearance(), backgroundOverride: { kind: 'scene', sceneId: 'aurora' } });
    expect(h.root.hasAttribute('data-background-source')).toBe(false);
    h.controller.setPreference({ ...defaultAppearance(), backgroundOverride: { kind: 'none' } });
    expect(h.root.hasAttribute('data-background')).toBe(false);
    expect(h.root.hasAttribute('data-background-source')).toBe(false);
  });

  it('works without document or matchMedia', () => {
    const h = appearanceHarness();
    const controller = createAppearanceStore({ ...h.environment, root: () => undefined, matchMedia: () => undefined });
    expect(() => controller.init()).not.toThrow();
    expect(() => controller.setPreference(safeAppearance())).not.toThrow();
  });
});

describe('storage exceptions', () => {
  it('reloads the actual saved new value after a write failure', () => {
    const h = appearanceHarness({ [KEY]: JSON.stringify(defaultAppearance()) });
    h.controller.init();
    h.storage.setItem.mockImplementation((key, value) => {
      if (key === KEY) throw new Error('blocked');
      h.values.set(key, value);
    });
    h.controller.setPreference({ ...defaultAppearance(), schemePreference: 'light', accentOverride: 'sky' });
    expect(h.values.get(THEME)).toBeUndefined();
    expect(h.values.get(ACCENT)).toBeUndefined();
    expect(h.root.dataset.theme).toBe('light');
    h.controller.dispose();
    h.controller.init();
    expect(h.controller.store.getState().preference).toEqual(defaultAppearance());
    expect(h.root.dataset.theme).toBe('dark');
    expect(h.root.hasAttribute('data-accent')).toBe(false);
  });

  it.each([KEY, THEME, ACCENT])('recovers getItem failure for %s and attempts repair', (failedKey) => {
    const h = appearanceHarness();
    h.storage.getItem.mockImplementation((key) => {
      if (key === failedKey) throw new Error('blocked');
      return null;
    });
    expect(() => h.controller.init()).not.toThrow();
    expect(h.controller.store.getState().preference).toEqual(safeAppearance());
    expect(h.storage.setItem).toHaveBeenCalledTimes(1);
    expect(h.environment.warn).toHaveBeenCalledWith(expect.stringContaining(failedKey));
  });

  it.each([KEY])('continues memory and DOM updates when %s cannot be saved', (failedKey) => {
    const h = appearanceHarness();
    h.storage.setItem.mockImplementation((key, value) => {
      if (key === failedKey) throw new DOMException('full', 'QuotaExceededError');
      h.values.set(key, value);
    });
    expect(() => h.controller.init()).not.toThrow();
    h.storage.setItem.mockClear();
    const preference = { ...defaultAppearance(), schemePreference: 'light' as const, accentOverride: 'sky' as const };
    expect(() => h.controller.setPreference(preference)).not.toThrow();
    expect(h.storage.setItem.mock.calls.map(([key]) => key)).toEqual([KEY]);
    expect(h.controller.store.getState().preference).toEqual(preference);
    expect(h.root.dataset).toMatchObject({ theme: 'light', accent: 'sky' });
    expect(h.values.has(failedKey)).toBe(false);
    expect(h.environment.warn).toHaveBeenCalledWith(expect.stringContaining(failedKey));
  });

  it('survives a blocked localStorage getter and total save failure', () => {
    const h = appearanceHarness();
    const controller = createAppearanceStore({
      ...h.environment,
      storage: () => {
        throw new Error('denied');
      },
    });
    expect(() => controller.init()).not.toThrow();
    expect(h.root.dataset.theme).toBe('dark');
    expect(h.environment.warn).toHaveBeenCalledTimes(2);
    expect(() => controller.setPreference({ ...defaultAppearance(), schemePreference: 'light' })).not.toThrow();
    expect(h.root.dataset.theme).toBe('light');
  });
});

it('automatically enables frosted glass only for images across OS changes', () => {
  const preference = {
    ...defaultAppearance(),
    schemePreference: 'system' as const,
    backgroundOverride: { kind: 'image' as const, assetId: '12345678-1234-1234-1234-123456789abc' },
  };
  const h = appearanceHarness({ [KEY]: JSON.stringify(preference) });
  h.controller.init();
  expect(h.root.dataset.glass).toBe('frosted');
  h.changeScheme(true);
  expect(h.root.dataset).toMatchObject({ theme: 'light', glass: 'frosted' });
  h.changeScheme(false);
  expect(h.root.dataset.glass).toBe('frosted');
  h.controller.setPreference({ ...preference, backgroundOverride: { kind: 'none' } });
  expect(h.root.dataset.glass).toBe('none');
  expect(JSON.parse(h.values.get(KEY)!)).not.toHaveProperty('glass');
});
