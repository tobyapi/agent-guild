import { expect, it } from 'vitest';
import { behaviorFixture } from '../behaviorFixtures.test-support';
import { ColorEnvelope, resolveTextProtection, validateRecipeStructure } from './index';
import type { TextState } from './index';

interface Recipe {
  layers: { kind: string; motif: string; motion: string; density: number }[];
  palette: Record<string, string[]>;
}
const recipe = behaviorFixture<{ input: Recipe }[]>('theme-backdrop-recipe.json')[0]!.input;

it('matches all 220 Rust catalog combinations and diagnostic precedence', () => {
  const allowed: Record<string, string[]> = {
    tile: ['star', 'cross', 'dot', 'wave', 'seaweed', 'tree', 'turtle'],
    halftone: ['hill', 'cloud', 'wave'],
    paper: ['hill', 'cloud', 'wave', 'seaweed', 'tree', 'turtle', 'aurora'],
    symbol: ['star', 'cross', 'dot', 'wave', 'seaweed', 'tree', 'turtle'],
  };
  let accepted = 0;
  let checked = 0;
  for (const kind of ['tile', 'halftone', 'paper', 'symbol', 'pixel']) {
    for (const motif of [
      'star',
      'cross',
      'dot',
      'wave',
      'seaweed',
      'tree',
      'turtle',
      'hill',
      'cloud',
      'aurora',
      'whale',
    ]) {
      for (const motion of ['none', 'drift', 'sway', 'spin']) {
        const input = structuredClone(recipe);
        Object.assign(input.layers[0]!, { kind, motif, motion, density: 0.5 });
        const diagnostic = expected(kind, motif, motion, allowed);
        if (diagnostic) expect(() => validateRecipeStructure(input)).toThrow(expect.objectContaining(diagnostic));
        else {
          expect(() => validateRecipeStructure(input)).not.toThrow();
          accepted++;
        }
        checked++;
      }
    }
  }
  expect([checked, accepted]).toEqual([220, 32]);
});

function expected(kind: string, motif: string, motion: string, allowed: Record<string, string[]>) {
  if (kind === 'pixel') return { field: 'layers[0].kind', code: 'unsupported_kind' };
  if (motion === 'spin') return { field: 'layers[0].motion', code: 'unsupported_motion' };
  if (!allowed[kind]!.includes(motif)) return { field: 'layers[0].motif', code: 'unsupported_motif' };
  if (motion === 'none') return null;
  if (motion === 'drift' && kind === 'paper' && ['cloud', 'wave', 'turtle', 'aurora'].includes(motif)) return null;
  if (motion === 'sway' && ['paper', 'symbol'].includes(kind) && ['tree', 'seaweed'].includes(motif)) return null;
  return { field: 'layers[0].motion', code: 'unsupported_motion' };
}

it('matches Rust overlays, transparent text, unresolved tokens and opaque thresholds', () => {
  const box = ColorEnvelope.fromRecipe(recipe, 'dark', { underlay: null, usesBlackShadow: true });
  const white: TextState = { text: { rgb: [1, 1, 1], alpha: 1 }, overlays: [] };
  const bad: TextState = { ...white, overlays: [{ rgb: [1, 1, 1], alpha: 1 }] };
  expect(() => resolveTextProtection(box, [0, 0, 0], [white, bad], false)).toThrow();
  expect(() =>
    resolveTextProtection(box, [0, 0, 0], [{ ...white, text: { rgb: [1, 1, 1], alpha: 0 } }], false),
  ).toThrow();
  const unresolved: TextState = { text: { rgb: [NaN, 0, 0], alpha: 1 }, overlays: [] };
  expect(resolveTextProtection(box, [0, 0, 0], [unresolved], false)).toEqual({ alpha: 1, verified: false });
  expect(resolveTextProtection(box, [0, 0, 0], [white], true)).toEqual({ alpha: 1, verified: true });
  for (const [ratio, passes] of [
    [4.55, true],
    [4.49, false],
  ] as const) {
    const gray = 1.055 * (1.05 / ratio - 0.05) ** (1 / 2.4) - 0.055;
    const action = () => resolveTextProtection(box, [gray, gray, gray], [white], true);
    if (passes) expect(action()).toEqual({ alpha: 1, verified: true });
    else expect(action).toThrow(expect.objectContaining({ code: 'text_protection_failed' }));
  }
});
