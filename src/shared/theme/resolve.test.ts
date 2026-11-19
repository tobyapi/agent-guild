import { describe, expect, it } from 'vitest';
import { defaultAppearance, themeRegistry } from './registry';
import { resolveAppearance } from './resolve';
import type { ThemeRegistry } from './types';

describe('resolveAppearance', () => {
  it('distinguishes theme default, explicit none and missing assets while preserving scheme/accent', () => {
    const registry: ThemeRegistry = {
      guild: {
        ...themeRegistry.guild!,
        variants: {
          dark: { background: { kind: 'image', assetId: 'night' } },
          light: { background: { kind: 'image', assetId: 'dawn' } },
        },
      },
    };
    const preference = { ...defaultAppearance(), schemePreference: 'light' as const, accentOverride: 'sky' as const };
    expect(resolveAppearance(preference, registry, 'dark').backgroundOverride).toEqual({
      kind: 'none',
    });
    expect(
      resolveAppearance({ ...preference, backgroundOverride: { kind: 'none' } }, registry, 'dark').backgroundOverride,
    ).toEqual({ kind: 'none' });
    const backgroundOverride = { kind: 'image' as const, assetId: 'missing' };
    expect(resolveAppearance({ ...preference, backgroundOverride }, registry, 'dark')).toMatchObject({
      scheme: 'light',
      accentOverride: 'sky',
      backgroundOverride: { kind: 'none' },
    });
    expect(resolveAppearance(defaultAppearance(), themeRegistry, 'dark').backgroundOverride).toEqual({ kind: 'none' });
  });
  it.each(['dark', 'light'] as const)('follows the OS only for system (%s)', (scheme) => {
    const preference = defaultAppearance();
    expect(resolveAppearance({ ...preference, schemePreference: 'system' }, themeRegistry, scheme).scheme).toBe(scheme);
    expect(resolveAppearance(preference, themeRegistry, scheme).scheme).toBe('dark');
    expect(resolveAppearance({ ...preference, schemePreference: 'light' }, themeRegistry, scheme).scheme).toBe('light');
  });

  it('returns IDs and policies without mutating the preference', () => {
    const preference = Object.freeze({
      ...defaultAppearance(),
      accentOverride: 'sky' as const,
    });
    expect(resolveAppearance(preference, themeRegistry, 'light')).toEqual({
      themeId: 'guild',
      scheme: 'dark',
      accentOverride: 'sky',
      backgroundOverride: { kind: 'none' },
      glass: 'none',
    });
  });

  it.each([{}, { guild: { ...themeRegistry.guild, variants: { dark: { background: { kind: 'none' } } } } }])(
    'uses existing CSS fallback even when guild variants are missing',
    (registry) => {
      expect(resolveAppearance(defaultAppearance(), registry as ThemeRegistry, 'light')).toMatchObject({
        themeId: 'guild',
        scheme: 'light',
        accentOverride: null,
        backgroundOverride: { kind: 'none' },
      });
    },
  );

  it('does not accept inherited theme IDs', () => {
    expect(resolveAppearance({ ...defaultAppearance(), themeId: 'toString' }, themeRegistry, 'light').themeId).toBe(
      'guild',
    );
  });
});
