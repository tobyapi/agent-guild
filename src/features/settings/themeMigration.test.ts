// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { defaultAppearance, themeRegistry } from '@/shared/theme/registry';
import { themeCards, selectThemeCard } from '@/shared/theme/catalog';
import { resolveAppearance } from '@/shared/theme/resolve';
import { appearanceHarness } from './appearance.test-support';
import { APPEARANCE_STORAGE_KEY as KEY } from './model/appearance';

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
      schemePreference: scheme,
      backgroundOverride: background,
      accentOverride: 'silver',
      motionPreference: 'off',
    };
    const h = appearanceHarness({ [KEY]: JSON.stringify(legacy) });
    h.controller.init();
    const expected = { ...legacy, themeId, schemePreference: fixed ?? scheme, backgroundOverride: null };
    expect(h.controller.store.getState().preference).toEqual(expected);
    expect(JSON.parse(h.values.get(KEY)!)).toEqual(expected);
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
  expect(h.controller.store.getState().preference.backgroundOverride).toBeNull();
});

it('canonicalizes old independent overrides on an art theme', () => {
  const h = appearanceHarness({
    [KEY]: JSON.stringify({
      ...defaultAppearance(),
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
    backgroundOverride: null,
  });
  expect(h.root.dataset).toMatchObject({ theme: 'dark', backgroundSource: 'image' });
});
