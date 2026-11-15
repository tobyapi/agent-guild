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
      themeId,
      schemePreference: fixed ?? scheme,
      backgroundOverride: background ?? { kind: 'none' },
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
    themeId: 'night',
    schemePreference: 'dark',
    backgroundOverride: { kind: 'image', assetId: 'night' },
  });
  expect(h.root.dataset).toMatchObject({ theme: 'dark', backgroundSource: 'image' });
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
    glass: { dark: 'frosted', light: 'frosted' },
  });
  expect(h.values.get(OLD)).toBe(stored);
  expect(h.values.get(THEME)).toBe('light');
  expect(h.values.get(ACCENT)).toBe('sky');
  expect(h.storage.setItem.mock.calls.map(([key]) => key)).toEqual([KEY]);
});

it('never reapplies the v1 art priority to a v2 independent selection', () => {
  const preference = {
    ...defaultAppearance(),
    themeId: 'night',
    schemePreference: 'light' as const,
    backgroundOverride: { kind: 'image' as const, assetId: 'dawn' },
  };
  const h = appearanceHarness({ [KEY]: JSON.stringify(preference) });
  h.controller.init();
  expect(h.controller.store.getState().preference).toEqual(preference);
  expect(h.root.dataset).toMatchObject({ theme: 'light', backgroundSource: 'image' });
  expect(h.storage.setItem).not.toHaveBeenCalled();
});
