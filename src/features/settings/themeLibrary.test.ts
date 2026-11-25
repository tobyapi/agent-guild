// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { savedTheme, imageId } from '@/shared/theme/candidate.test-support';
import type { SavedTheme } from '@/shared/theme/candidate';
import { ColorEnvelope } from '@/shared/lib/themeBackdrop/envelope';
import { rgb, worstRatio } from '@/shared/theme/themeColors';
import { resolveAppearance } from '@/shared/theme/resolve';
import { DEFAULT_MASCOT_LAYOUT } from '@/shared/theme/mascot';
import { defaultAppearance } from '@/shared/theme/registry';
import { appearanceHarness, storedLibrary } from './appearance.test-support';
import { LIBRARY_KEY } from './themeLibrary';

it('restores mascot mode, source and layout across restarts and theme undo', () => {
  const h = appearanceHarness({ [LIBRARY_KEY]: storedLibrary(defaultAppearance()) });
  const c = h.controller;
  c.init();
  expect(c.store.getState().mascot.layout).toEqual(DEFAULT_MASCOT_LAYOUT);
  const mascot = {
    source: { kind: 'generated' as const, id: imageId },
    layout: { ...DEFAULT_MASCOT_LAYOUT, mascot: { x: 12, y: 85, size: 120 } },
  };
  expect(c.setMascot(mascot)).toBe(true);
  expect(c.setPreference({ ...c.store.getState().active, backgroundOverride: { kind: 'mascot' } })).toBe(true);
  expect(h.root.dataset.backgroundSource).toBe('mascot');
  expect(h.root.dataset.background).toBeUndefined();
  expect(c.saveTheme(savedTheme(), true)).toBe(true);
  expect(h.root.dataset.backgroundSource).toBe('image');
  c.dispose();
  c.init();
  expect(c.undo()).toBe(true);
  expect(c.store.getState().active.backgroundOverride).toEqual({ kind: 'mascot' });
  expect(c.store.getState().mascot).toEqual(mascot);
  expect(h.root.dataset.glass).toBe('none');
});

const legacyTheme = {
  ...savedTheme(),
  schemaVersion: 1,
  id: 'user-abcdefab-1234-1234-1234-123456789abc',
  variants: {
    dark: { surface: '#131316', text: '#ffffff', muted: '#8f8e8f', accent: '#f0ce94' },
    light: { surface: '#fffefa', text: '#111111', muted: '#666666', accent: '#51360d' },
  },
} satisfies SavedTheme;

it('saves without applying, then shares one image across schemes and restores a full snapshot on restart', () => {
  const old = storedLibrary({
    ...defaultAppearance(),
    accentOverride: 'sky',
    motionPreference: 'off',
    schemePreference: 'system',
  });
  const h = appearanceHarness({ [LIBRARY_KEY]: old });
  const c = h.controller;
  c.init();
  const before = c.store.getState().active;
  const theme = savedTheme();
  expect(c.saveTheme(theme, false)).toBe(true);
  expect(c.store.getState().active).toEqual(before);
  expect(c.select(theme.id)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    const { active, registry } = c.store.getState();
    expect(resolveAppearance(active, registry, scheme)).toMatchObject({
      scheme,
      backgroundOverride: { kind: 'image', assetId: imageId },
    });
  }
  c.dispose();
  c.init();
  expect(c.undo()).toBe(true);
  expect(c.store.getState().active).toEqual(before);
  expect(c.store.getState().themes).toEqual([theme]);
  expect(c.undo()).toBe(false);
});
it('preserves newer versions byte-for-byte and refuses writes', () => {
  for (const data of [
    { version: 4 },
    { version: 3, themes: [{ ...savedTheme(), schemaVersion: 3 }], active: defaultAppearance(), previous: null },
  ]) {
    const raw = JSON.stringify(data);
    const h = appearanceHarness({ [LIBRARY_KEY]: raw });
    h.controller.init();
    expect(h.controller.store.getState().readOnly).toBe(true);
    expect(h.controller.saveTheme(savedTheme(), true)).toBe(false);
    expect(h.values.get(LIBRARY_KEY)).toBe(raw);
  }
});
it('keeps selection on a failed write, accepts retry, and falls back after deleting the active theme', () => {
  const h = appearanceHarness();
  const c = h.controller;
  c.init();
  h.storage.setItem.mockImplementationOnce(() => {
    throw new Error('quota');
  });
  expect(c.saveTheme(savedTheme(), true)).toBe(false);
  expect(c.store.getState().themes).toHaveLength(0);
  expect(c.saveTheme(savedTheme(), true)).toBe(true);
  c.missingImage(imageId);
  expect(h.root.dataset.background).toBeUndefined();
  expect(c.store.getState().themes[0]?.backgroundId).toBe(imageId);
  expect(c.remove(savedTheme().id)).toBe(true);
  expect(h.root.dataset.themeId).toBe('guild');
});

it('adapts the accent on glass while retaining the opaque accent and persisted preference', () => {
  const theme = savedTheme();
  theme.variants = { ...theme.variants, dark: { ...theme.variants.dark, surface: '#303030' } };
  const h = appearanceHarness();
  const c = h.controller;
  c.init();
  expect(c.saveTheme(theme, true)).toBe(true);
  expect(c.setPreference({ ...c.store.getState().active, accentOverride: 'vermilion' })).toBe(true);
  expect(h.root.style.getPropertyValue('--accent-text')).toBe('#ff8f6b');
  expect(h.root.style.getPropertyValue('--glass-accent-text')).not.toBe('#ff8f6b');
  expect(JSON.parse(h.values.get(LIBRARY_KEY)!)).toMatchObject({ active: { accentOverride: 'vermilion' } });
});

it('rejects saved themes whose divider shape does not match their schema version', () => {
  const newer = savedTheme();
  const h = appearanceHarness({
    [LIBRARY_KEY]: JSON.stringify({
      version: 3,
      themes: [
        { ...newer, schemaVersion: 1 },
        { ...legacyTheme, schemaVersion: 2 },
        { ...newer, variants: { ...newer.variants, light: legacyTheme.variants.light } },
      ],
      active: defaultAppearance(),
      previous: null,
    }),
  });
  h.controller.init();
  expect(h.controller.store.getState()).toMatchObject({ themes: [], readOnly: false });
});

it('loads a saved theme near the old 92% glass contrast threshold', () => {
  const { surface, muted } = legacyTheme.variants.dark;
  const oldVeil = ColorEnvelope.fullRgb().over(rgb(surface), 0.92).roundedOut();
  const oldRatio = worstRatio(muted, oldVeil);
  expect(oldRatio).toBeGreaterThanOrEqual(4.6);
  expect(oldRatio).toBeLessThan(4.61);

  const active = { ...defaultAppearance(), themeId: legacyTheme.id, schemePreference: 'dark' };
  const h = appearanceHarness({
    [LIBRARY_KEY]: JSON.stringify({ version: 3, themes: [legacyTheme], active, previous: null }),
  });
  h.controller.init();
  expect(h.controller.store.getState()).toMatchObject({ themes: [legacyTheme], active, readOnly: false });
  expect(h.root.style.getPropertyValue('--text-muted')).toBe(muted);
  expect(h.root.style.getPropertyValue('--glass-text-muted')).not.toBe(muted);
});

it('loads legacy themes and clears divider overrides on switching, undo and deletion', () => {
  const newer = savedTheme();
  const legacy = legacyTheme;
  const active = { ...defaultAppearance(), themeId: legacy.id, backgroundOverride: null };
  const h = appearanceHarness({
    [LIBRARY_KEY]: JSON.stringify({ version: 3, themes: [legacy, newer], active, previous: null }),
  });
  const c = h.controller;
  const divider = () => h.root.style.getPropertyValue('--area-divider-style');
  c.init();
  expect(c.store.getState().themes).toEqual([legacy, newer]);
  expect(h.root.dataset.background).toBe('active');
  expect(divider()).toBe('');
  expect(c.select(newer.id)).toBe(true);
  expect(divider()).toBe('dashed');
  expect(c.undo()).toBe(true);
  expect(divider()).toBe('');
  expect(c.select(newer.id)).toBe(true);
  expect(c.remove(newer.id)).toBe(true);
  expect(h.root.dataset.themeId).toBe(legacy.id);
  expect(divider()).toBe('');
  expect(h.root.style.getPropertyValue('--glass-edge')).toBe('');
  expect(h.root.dataset.background).toBe('active');
});

it('reads v3 active and previous selections with obsolete motion values and omits them on save', () => {
  const theme = savedTheme();
  const active = { ...defaultAppearance(), themeId: theme.id, backgroundOverride: null };
  const previous = { ...defaultAppearance(), accentOverride: 'sky' };
  const h = appearanceHarness({
    [LIBRARY_KEY]: JSON.stringify({
      version: 3,
      themes: [theme],
      active: { ...active, motionPreference: 'off' },
      previous: { ...previous, motionPreference: 'unrecognized' },
    }),
  });
  const c = h.controller;
  c.init();
  expect(c.store.getState()).toMatchObject({ active, previous, themes: [theme] });
  expect(c.undo()).toBe(true);
  const saved: unknown = JSON.parse(h.values.get(LIBRARY_KEY)!);
  expect(saved).toEqual({ version: 3, active: previous, previous: null, themes: [theme] });
  expect(h.values.get(LIBRARY_KEY)).not.toContain('motionPreference');
});
