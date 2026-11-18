// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { savedTheme, imageId } from '@/shared/theme/candidate.test-support';
import { resolveAppearance } from '@/shared/theme/resolve';
import { defaultAppearance } from '@/shared/theme/registry';
import { appearanceHarness } from './appearance.test-support';
import { LIBRARY_KEY } from './themeLibrary';
import { APPEARANCE_STORAGE_KEY } from './model/appearance';

it('saves without applying, then shares one image across schemes and restores a full snapshot on restart', () => {
  const old = JSON.stringify({
    ...defaultAppearance(),
    accentOverride: 'sky',
    motionPreference: 'off',
    schemePreference: 'system',
  });
  const h = appearanceHarness({ [APPEARANCE_STORAGE_KEY]: old });
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
      motion: 'off',
    });
  }
  c.dispose();
  c.init();
  expect(c.undo()).toBe(true);
  expect(c.store.getState().active).toEqual(before);
  expect(c.store.getState().themes).toEqual([theme]);
  expect(c.undo()).toBe(false);
  expect(h.values.get(APPEARANCE_STORAGE_KEY)).toBe(old);
});
it('preserves newer versions byte-for-byte and refuses writes', () => {
  for (const data of [
    { version: 4 },
    { version: 3, themes: [{ ...savedTheme(), schemaVersion: 2 }], active: defaultAppearance(), previous: null },
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

it('rejects an otherwise readable theme accent when the replacement fails only on glass', () => {
  const theme = savedTheme();
  theme.variants = { ...theme.variants, dark: { ...theme.variants.dark, surface: '#303030' } };
  const h = appearanceHarness();
  const c = h.controller;
  c.init();
  expect(c.saveTheme(theme, true)).toBe(true);
  const before = h.values.get(LIBRARY_KEY);
  expect(c.setPreference({ ...c.store.getState().active, accentOverride: 'vermilion' })).toBe(false);
  expect(c.store.getState().issues).toContainEqual(
    expect.objectContaining({ scheme: 'dark', background: 'glass', required: 4.6 }),
  );
  expect(h.values.get(LIBRARY_KEY)).toBe(before);
  expect(h.root.dataset.accent).toBeUndefined();
});
