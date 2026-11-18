import { expect, it } from 'vitest';
import { parseCandidate } from './candidate';
import { candidate } from './candidate.test-support';
import { checkTheme } from './checkTheme';
import { ColorEnvelope } from '../lib/themeBackdrop/envelope';
import { solid, worstRatio } from './themeColors';
import { themeTokens, paletteTokens } from './themeTokens';
import { FOCUS_MIN, GLASS_TEXT_MIN } from './glassTheme';
import { readFileSync } from 'node:fs';

const glassCss = readFileSync('src/shared/ui/theme/tokens-glass.css', 'utf8');

it('accepts the full light/dark candidate and rejects untrusted schema, styles and image paths', () => {
  expect(parseCandidate(JSON.stringify(candidate))).toEqual(candidate);
  expect(checkTheme(candidate)).toEqual([]);
  for (const altered of [
    { schemaVersion: 1 },
    { schemaVersion: 3 },
    { typeStyle: 'serifBody' },
    { name: '' },
    { corners: 'url(x)' },
    { extra: true },
    { background: { kind: 'image', assetId: 'file.png' } },
    { variants: { ...candidate.variants, dark: { ...candidate.variants.dark, accent: '#fff8' } } },
  ]) {
    expect(() => parseCandidate(JSON.stringify({ ...candidate, ...altered }))).toThrow();
  }
});
it('checks derived opaque surfaces, button ink and opaque focus-ring boundaries', () => {
  const variants = { ...candidate.variants, dark: { ...candidate.variants.dark, accent: '#303030', muted: '#777777' } };
  const issues = checkTheme({ ...candidate, variants });
  for (const background of ['selection-bg', 'bg-app']) {
    expect(issues).toContainEqual(
      expect.objectContaining({ scheme: 'dark', foreground: 'focus-color', background, required: 3 }),
    );
  }
  expect(issues).toContainEqual(
    expect.objectContaining({ foreground: 'text-muted', background: 'bg-active', required: 4.5 }),
  );
  expect(
    checkTheme({
      ...candidate,
      variants: { ...candidate.variants, light: { ...candidate.variants.light, accent: '#7e7e7e' } },
    }),
  ).toContainEqual(expect.objectContaining({ background: 'accent', required: 7 }));
});
it('uses the darkest or brightest admissible background and detects ink inside the range', () => {
  const range = ColorEnvelope.fullRgb();
  expect(worstRatio('#808080', range)).toBe(1);
  expect(worstRatio('#ffffff', solid('#000000'))).toBeCloseTo(21);
  expect(worstRatio('#000000', solid('#ffffff'))).toBeCloseTo(21);
});
it('changes only heading font and control radii and regenerates all accent-derived tokens', () => {
  const original = themeTokens(candidate, 'dark', null);
  const overridden = themeTokens(candidate, 'dark', 'sky');
  expect(original['font-heading']).toContain('Mincho');
  expect(original['font-sans']).toBeUndefined();
  expect(original['radius-md']).toBe('12px');
  for (const key of ['accent', 'accent-hover', 'focus-color', 'selection-bg'])
    expect(overridden[key]).not.toBe(original[key]);
});

it('requires safe divider color, style and width in both new variants', () => {
  for (const divider of [
    undefined,
    { color: '#fff', style: 'solid', width: 1 },
    { color: '#ffffff', style: 'double', width: 2 },
    { color: '#ffffff', style: 'none', width: 1 },
    { color: '#ffffff', style: 'dashed', width: '3' },
    { color: '#ffffff', style: 'dotted', width: 2 },
    { color: '#ffffff', style: 'solid', width: 2, css: 'inherit' },
  ]) {
    const light = { ...candidate.variants.light, divider };
    expect(() =>
      parseCandidate(JSON.stringify({ ...candidate, variants: { ...candidate.variants, light } })),
    ).toThrow();
  }
  const dark = { ...candidate.variants.dark, divider: { color: '#ffffff', style: 'none', width: 0 } };
  const parsed = parseCandidate(JSON.stringify({ ...candidate, variants: { ...candidate.variants, dark } }));
  expect(themeTokens(parsed, 'dark', null)).toMatchObject({
    'area-divider-style': 'var(--hidden-divider-style, none)',
    'area-divider-width': 'var(--hidden-divider-width, 0px)',
    'border-hover': '#ffffff',
  });
});

it('uses the built-in veil and checks the actual glass paint over every possible image', () => {
  for (const scheme of ['dark', 'light'] as const) {
    const p = { ...candidate.variants[scheme], muted: scheme === 'dark' ? '#999999' : '#666666' };
    const { tokens, glassInks, inks, glassFocus, veil, fills } = paletteTokens(p, scheme, null);
    const css = (scheme === 'dark' ? glassCss : glassCss.split(":root[data-theme='light']")[1]!).split('}')[0]!;
    const hex = css.match(/--glass-veil-color: (#[a-f0-9]{6});/)![1]!;
    const opacity = Number(css.match(/--glass-veil-weight: (\d+)%;/)![1]) / 100;
    const rgb = solid(hex).corners()[0]!;
    expect(veil.corners()).toEqual(ColorEnvelope.fullRgb().over(rgb, opacity).roundedOut().corners());
    expect(tokens).not.toHaveProperty('glass-veil-weight');
    expect(tokens).not.toHaveProperty('glass-veil-color');
    expect(worstRatio(inks['text-muted']!, veil)).toBeLessThan(GLASS_TEXT_MIN);
    for (const [name, ink] of Object.entries(glassInks)) {
      expect(tokens['glass-' + name]).toBe(ink);
      expect(worstRatio(ink, veil)).toBeGreaterThanOrEqual(4.6);
    }
    expect(tokens['glass-syntax-comment']).toBe(glassInks['text-muted']);
    expect(worstRatio(glassFocus, veil)).toBeGreaterThanOrEqual(FOCUS_MIN);
    expect(worstRatio(glassFocus, solid(fills['bg-app']!))).toBeGreaterThanOrEqual(FOCUS_MIN);
    expect(checkTheme({ ...candidate, variants: { ...candidate.variants, [scheme]: p } })).toEqual([]);
  }
});
