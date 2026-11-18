import { expect, it } from 'vitest';
import { parseCandidate } from './candidate';
import { candidate } from './candidate.test-support';
import { checkTheme } from './checkTheme';
import { ColorEnvelope } from '../lib/themeBackdrop/envelope';
import { solid, worstRatio } from './themeColors';
import { themeTokens } from './themeTokens';

it('accepts the full light/dark candidate and rejects untrusted schema, styles and image paths', () => {
  expect(parseCandidate(JSON.stringify(candidate))).toEqual(candidate);
  expect(checkTheme(candidate)).toEqual([]);
  for (const altered of [
    { schemaVersion: 2 },
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
it('checks derived selected surfaces, button ink, both ring boundaries and glass before rounding', () => {
  const variants = { ...candidate.variants, dark: { ...candidate.variants.dark, accent: '#303030', muted: '#777777' } };
  const issues = checkTheme({ ...candidate, variants });
  for (const background of ['selection-bg', 'bg-app', 'glass']) {
    expect(issues).toContainEqual(
      expect.objectContaining({ scheme: 'dark', foreground: 'focus-color', background, required: 3 }),
    );
  }
  expect(issues).toContainEqual(
    expect.objectContaining({ foreground: 'text-muted', background: 'glass', required: 4.6 }),
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
