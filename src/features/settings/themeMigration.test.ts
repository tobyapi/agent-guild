// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { defaultAppearance, themeRegistry } from '@/shared/theme/registry';
import { themeCards, selectThemeCard } from '@/shared/theme/catalog';
import { resolveAppearance } from '@/shared/theme/resolve';
import { THEME_STORAGE_KEY as THEME } from './model/theme';
import { ACCENT_STORAGE_KEY as ACCENT } from './model/accent';
import { appearanceHarness } from './appearance.test-support';
import { APPEARANCE_STORAGE_KEY as KEY, LEGACY_APPEARANCE_STORAGE_KEY as OLD } from './model/appearance';

const backgrounds = [
  [null, 'guild', null],
  [{ kind: 'none' }, 'guild', null],
  [{ kind: 'image', assetId: 'dawn' }, 'dawn', 'light'],
  [{ kind: 'image', assetId: 'night' }, 'night', 'dark'],
  [{ kind: 'scene', sceneId: 'aurora' }, 'aurora', 'dark'],
  [{ kind: 'generated', presetId: 'tile-turtle' }, 'turtle', 'light'],
] as const;

it.each(
  (['dark', 'light', 'system'] as const).flatMap((scheme) =>
    backgrounds.map(([background, themeId, fixed]) => ({ scheme, background, themeId, fixed })),
  ),
)(
  'migrates v1 $scheme/$themeId and persists an idempotent unified selection',
  ({ scheme, background, themeId, fixed }) => {
    const legacy = {
      ...defaultAppearance(),
      version: 1,
      schemePreference: scheme,
      backgroundOverride: background,
      accentOverride: 'silver',
      motionPreference: 'off',
    };
    const h = appearanceHarness({ [OLD]: JSON.stringify(legacy) });
    h.controller.init();
    const expected = {
      ...legacy,
      version: 2,
      themeId: ['dawn', 'night', 'aurora', 'turtle'].includes(themeId) ? 'guild' : themeId,
      schemePreference: fixed ?? scheme,
      backgroundOverride: ['dawn', 'night', 'aurora', 'turtle'].includes(themeId)
        ? { kind: 'none' }
        : (background ?? { kind: 'none' }),
    };
    expect(h.controller.store.getState().preference).toEqual(expected);
    expect(JSON.parse(h.values.get(KEY)!)).toEqual(expected);
    expect(h.values.get(OLD)).toBe(JSON.stringify(legacy));
    h.controller.dispose();
    h.storage.setItem.mockClear();
    h.controller.init();
    expect(h.controller.store.getState().preference).toEqual(expected);
    expect(h.storage.setItem).not.toHaveBeenCalled();
  },
);

it.each(themeCards)('resolves card $id consistently for both OS schemes and sets the right source', (card) => {
  const preference = selectThemeCard(defaultAppearance(), card);
  const h = appearanceHarness({ [KEY]: JSON.stringify(preference) });
  h.query.matches = true;
  h.controller.init();
  for (const system of ['light', 'dark'] as const) {
    expect(resolveAppearance(preference, themeRegistry, system)).toMatchObject({
      scheme: card.scheme === 'system' ? system : card.scheme,
      backgroundOverride: card.background,
    });
  }
  expect(h.root.dataset.backgroundSource).toBe(card.background.kind === 'none' ? undefined : card.background.kind);
  expect(h.controller.store.getState().preference.backgroundOverride).toEqual(card.background);
});

it('canonicalizes old independent overrides on an art theme', () => {
  const h = appearanceHarness({
    [OLD]: JSON.stringify({
      ...defaultAppearance(),
      version: 1,
      themeId: 'night',
      schemePreference: 'system',
      backgroundOverride: { kind: 'image', assetId: 'dawn' },
    }),
  });
  h.query.matches = true;
  h.controller.init();
  expect(h.controller.store.getState().preference).toMatchObject({
    themeId: 'guild',
    schemePreference: 'dark',
    backgroundOverride: { kind: 'none' },
  });
  expect(h.root.dataset.theme).toBe('dark');
  expect(h.root.hasAttribute('data-background-source')).toBe(false);
});

it.each(themeCards)('migrates the saved v1 card $id without modifying any old key', (card) => {
  const legacy = {
    ...defaultAppearance(),
    version: 1,
    themeId: card.themeId,
    schemePreference: card.scheme,
    backgroundOverride: null,
  };
  const stored = JSON.stringify(legacy);
  const h = appearanceHarness({ [OLD]: stored, [THEME]: 'light', [ACCENT]: 'sky' });
  h.controller.init();
  expect(h.controller.store.getState().preference).toMatchObject({
    version: 2,
    schemePreference: card.scheme,
    backgroundOverride: card.background,
  });
  expect(h.values.get(OLD)).toBe(stored);
  expect(h.values.get(THEME)).toBe('light');
  expect(h.values.get(ACCENT)).toBe('sky');
  expect(h.storage.setItem.mock.calls.map(([key]) => key)).toEqual([KEY]);
});

it('never reapplies the v1 art priority to a v2 independent selection', () => {
  const preference = {
    ...defaultAppearance(),
    themeId: 'guild',
    schemePreference: 'dark' as const,
    backgroundOverride: { kind: 'none' as const },
  };
  const h = appearanceHarness({ [KEY]: JSON.stringify(preference) });
  h.controller.init();
  expect(h.controller.store.getState().preference).toEqual(preference);
  expect(h.root.dataset.theme).toBe('dark');
  expect(h.root.hasAttribute('data-background-source')).toBe(false);
  expect(h.storage.setItem).not.toHaveBeenCalled();
});

it.each(
  (['dark', 'light', 'system'] as const).flatMap((schemePreference) =>
    backgrounds
      .slice(2)
      .flatMap(([backgroundOverride, retiredId]) =>
        ['guild', retiredId].map((themeId) => ({ schemePreference, backgroundOverride, themeId })),
      ),
  ),
)('clears retired v2 $themeId/$schemePreference without losing independent preferences', (selection) => {
  const preference = {
    ...defaultAppearance(),
    ...selection,
    accentOverride: 'sky' as const,
    motionPreference: 'off' as const,
  };
  const h = appearanceHarness({ [KEY]: JSON.stringify(preference) });
  h.controller.init();
  expect(h.controller.store.getState().preference).toEqual({
    ...preference,
    themeId: 'guild',
    backgroundOverride: { kind: 'none' },
  });
  expect(JSON.parse(h.values.get(KEY)!)).toEqual(h.controller.store.getState().preference);
  expect(h.storage.setItem.mock.calls.map(([key]) => key)).toEqual([KEY]);
  expect(h.root.hasAttribute('data-background')).toBe(false);
});

it.each(backgrounds.slice(2))('migrates retired v1 card %j with its original scheme', (background, themeId, scheme) => {
  const legacy = {
    ...defaultAppearance(),
    version: 1,
    themeId,
    schemePreference: 'system',
    backgroundOverride: background,
  };
  const stored = JSON.stringify(legacy);
  const h = appearanceHarness({ [OLD]: stored, [THEME]: 'light', [ACCENT]: 'sky' });
  h.controller.init();
  expect(h.controller.store.getState().preference).toMatchObject({
    version: 2,
    themeId: 'guild',
    schemePreference: scheme,
    backgroundOverride: { kind: 'none' },
  });
  expect(h.values.get(OLD)).toBe(stored);
  expect(h.values.get(THEME)).toBe('light');
  expect(h.values.get(ACCENT)).toBe('sky');
  expect(h.storage.setItem.mock.calls.map(([key]) => key)).toEqual([KEY]);
});

it('retains independent v2 settings when the retired turtle theme has no background', () => {
  const preference = {
    ...defaultAppearance(),
    themeId: 'turtle',
    schemePreference: 'system' as const,
    accentOverride: 'silver' as const,
    motionPreference: 'off' as const,
  };
  const legacy = JSON.stringify({ ...preference, version: 1 });
  const h = appearanceHarness({ [KEY]: JSON.stringify(preference), [OLD]: legacy, [THEME]: 'light', [ACCENT]: 'sky' });
  h.controller.init();
  expect(h.controller.store.getState().preference).toEqual({ ...preference, themeId: 'guild' });
  expect(h.values.get(OLD)).toBe(legacy);
  expect(h.values.get(THEME)).toBe('light');
  expect(h.values.get(ACCENT)).toBe('sky');
  expect(h.storage.setItem.mock.calls.map(([key]) => key)).toEqual([KEY]);
  h.controller.dispose();
  h.storage.setItem.mockClear();
  h.controller.init();
  expect(h.storage.setItem).not.toHaveBeenCalled();
});
