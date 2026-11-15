// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { defaultAppearance, safeAppearance, themeRegistry } from '@/shared/theme/registry';
import type { ThemeRegistry } from '@/shared/theme/types';
import { APPEARANCE_STORAGE_KEY as KEY } from './model/appearance';
import { ACCENTS, ACCENT_STORAGE_KEY as ACCENT } from './model/accent';
import { THEME_STORAGE_KEY as THEME } from './model/theme';
import { appearanceHarness } from './appearance.test-support';

describe('legacy appearance migration', () => {
  const cases = (['dark', 'light', 'system'] as const).flatMap((scheme) =>
    ACCENTS.map((accent) => ({ scheme, accent })),
  );
  it.each(cases)('migrates $scheme/$accent once and retains synchronized legacy keys', ({ scheme, accent }) => {
    const h = appearanceHarness({ [THEME]: scheme, [ACCENT]: accent });
    h.controller.init();
    h.controller.init();
    const preference = h.controller.store.getState().preference;
    expect(preference).toEqual({
      ...defaultAppearance(),
      schemePreference: scheme,
      accentOverride: accent === 'default' ? null : accent,
    });
    expect(JSON.parse(h.values.get(KEY)!)).toEqual(preference);
    expect(h.storage.setItem.mock.calls.filter(([key]) => key === KEY)).toHaveLength(1);
    expect(h.values.get(THEME)).toBe(scheme);
    expect(h.values.get(ACCENT)).toBe(accent);
    expect(h.query.addEventListener).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{}, 'dark', null],
    [{ [THEME]: 'light' }, 'light', null],
    [{ [ACCENT]: 'sky' }, 'dark', 'sky'],
  ] as const)('preserves defaults for absent legacy fields (%j)', (initial, scheme, accent) => {
    const h = appearanceHarness(initial);
    h.controller.init();
    expect(h.controller.store.getState().preference).toMatchObject({
      schemePreference: scheme,
      accentOverride: accent,
    });
  });

  it('prioritizes valid new data, including after changes made by an old version', () => {
    const preference = { ...defaultAppearance(), schemePreference: 'light', accentOverride: 'silver' };
    const h = appearanceHarness({ [KEY]: JSON.stringify(preference), [THEME]: 'dark', [ACCENT]: 'sky' });
    h.controller.init();
    expect(h.controller.store.getState().preference).toEqual(preference);
    expect(h.storage.getItem.mock.calls).toEqual([[KEY]]);
    expect(h.storage.setItem).not.toHaveBeenCalled();
    expect(h.root.dataset.theme).toBe('light');
    expect(h.root.dataset.accent).toBe('silver');
  });
});

describe('invalid appearance recovery', () => {
  it('discards a retired generated ID and embedded recipe fields', () => {
    const h = appearanceHarness({
      [KEY]: JSON.stringify({
        ...defaultAppearance(),
        backgroundOverride: { kind: 'generated', presetId: 'tile-turtle', recipe: { untrusted: true } },
      }),
    });
    h.controller.init();
    expect(h.controller.store.getState().preference).toMatchObject({
      themeId: 'guild',
      schemePreference: 'dark',
      backgroundOverride: { kind: 'none' },
    });
    expect(h.root.dataset.backgroundSource).toBeUndefined();
  });
  it.each([
    ['{bad', 'malformed JSON'],
    ['{"version":99}', 'unsupported appearance version'],
    [JSON.stringify({ ...defaultAppearance(), themeId: 'nope' }), 'unknown theme or missing variants'],
  ])('logs a safe recovery reason for %s', (stored, reason) => {
    const h = appearanceHarness({ [KEY]: stored });
    h.controller.init();
    expect(h.environment.warn).toHaveBeenCalledWith(`${KEY}: ${reason}; restoring guild/system`);
  });

  it.each([
    '{bad',
    '{"version":99}',
    '{"themeId":"nope"}',
    'null',
    '[]',
    JSON.stringify({ ...defaultAppearance(), themeId: 'nope' }),
    JSON.stringify({ ...defaultAppearance(), schemePreference: undefined }),
    JSON.stringify({ ...defaultAppearance(), schemePreference: 'sepia' }),
    JSON.stringify({ ...defaultAppearance(), accentOverride: 'nope' }),
    JSON.stringify({ ...defaultAppearance(), backgroundOverride: {} }),
    JSON.stringify({ ...defaultAppearance(), motionPreference: 'on' }),
  ])('repairs invalid new data without adopting legacy values: %s', (stored) => {
    const h = appearanceHarness({ [KEY]: stored, [THEME]: 'light', [ACCENT]: 'sky' });
    h.controller.init();
    expect(h.controller.store.getState().preference).toEqual(safeAppearance());
    expect(JSON.parse(h.values.get(KEY)!)).toEqual(safeAppearance());
    expect(h.values.get(THEME)).toBe('light');
    expect(h.values.get(ACCENT)).toBe('sky');
    expect(h.environment.warn).toHaveBeenCalledWith(expect.stringContaining(KEY));
    expect(h.environment.warn.mock.calls.flat().join(' ')).not.toContain(stored);
  });

  it.each<Record<string, string>>([{ [THEME]: 'sepia' }, { [ACCENT]: 'unknown' }])(
    'recovers invalid legacy values (%j)',
    (initial) => {
      const h = appearanceHarness(initial);
      h.controller.init();
      expect(h.controller.store.getState().preference).toEqual(safeAppearance());
      expect(h.environment.warn).toHaveBeenCalled();
    },
  );

  it.each([{}, { guild: { ...themeRegistry.guild, variants: { dark: { background: { kind: 'none' } } } } }])(
    'recovers missing registry variants',
    (registry) => {
      const h = appearanceHarness({ [KEY]: JSON.stringify(defaultAppearance()) }, registry as ThemeRegistry);
      h.query.matches = true;
      h.controller.init();
      expect(h.controller.store.getState().preference).toEqual(safeAppearance());
      expect(h.root.dataset.theme).toBe('light');
      expect(h.environment.warn).toHaveBeenCalled();
    },
  );

  it.each([
    { kind: 'image', assetId: 'missing' },
    { kind: 'scene', sceneId: 'missing' },
    { kind: 'generated', presetId: 'missing' },
  ])('disables missing background references without losing other settings', (backgroundOverride) => {
    const h = appearanceHarness({
      [KEY]: JSON.stringify({ ...defaultAppearance(), accentOverride: 'sky', backgroundOverride }),
    });
    h.controller.init();
    expect(h.controller.store.getState().preference).toEqual({
      ...defaultAppearance(),
      accentOverride: 'sky',
      backgroundOverride: { kind: 'none' },
    });
  });
});

it.each([undefined, null, 'invalid', { dark: 'liquid', light: 'liquid' }, { dark: 'invalid' }])(
  'ignores obsolete glass %j while preserving all independent v2 settings',
  (glass) => {
    const preference = {
      ...defaultAppearance(),
      schemePreference: 'system' as const,
      accentOverride: 'sky' as const,
      motionPreference: 'off' as const,
      backgroundOverride: { kind: 'image' as const, assetId: '12345678-1234-1234-1234-123456789abc' },
    };
    const h = appearanceHarness({ [KEY]: JSON.stringify({ ...preference, glass }) });
    h.controller.init();
    expect(h.controller.store.getState().preference).toEqual(preference);
    expect(JSON.parse(h.values.get(KEY)!)).toEqual(preference);
    expect(JSON.parse(h.values.get(KEY)!)).not.toHaveProperty('glass');
    expect(h.root.dataset).toMatchObject({ theme: 'dark', glass: 'frosted', accent: 'sky' });
    h.changeScheme(true);
    expect(h.root.dataset).toMatchObject({ theme: 'light', glass: 'frosted', accent: 'sky' });
    expect(h.environment.warn).not.toHaveBeenCalled();
    h.controller.dispose();
    h.storage.setItem.mockClear();
    h.controller.init();
    expect(h.storage.setItem).not.toHaveBeenCalled();
  },
);
