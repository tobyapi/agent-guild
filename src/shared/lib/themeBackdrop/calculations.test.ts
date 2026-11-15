import { describe, expect, it } from 'vitest';
import { behaviorFixture } from '../behaviorFixtures.test-support';
import { ColorEnvelope, resolveTextProtection, validateRecipeCost } from './index';
import type { DrawingCost, Rgb } from './index';

interface Recipe {
  palette: Record<string, string[]>;
  layers: { motion: string }[];
}
const cases =
  behaviorFixture<{ name: string; input: Recipe; expected: { valid: boolean } }[]>('theme-backdrop-recipe.json');
const zero: DrawingCost = { primitives: 0, dom: 0, definitions: 0, movingGroups: 0 };
const recipe = cases[0]!.input;

describe('Recipe calculations: same Rust inputs', () => {
  it('rejects invalid expansion and overflow', () => {
    expect(() => validateRecipeCost(recipe, [NaN, 1], zero, [])).toThrow(
      expect.objectContaining({ code: 'invalid_expansion' }),
    );
    const patterns = [{ width: Number.MIN_VALUE, height: Number.MIN_VALUE, primitives: 1 }];
    expect(() => validateRecipeCost(recipe, [1920, 1080], zero, [{ cost: zero, patterns }])).toThrow(
      expect.objectContaining({ code: 'primitive_budget_exceeded' }),
    );
  });

  it('rejects unresolved or unreadable protection', () => {
    const input = structuredClone(recipe);
    const box = ColorEnvelope.fromRecipe(input, 'light', { underlay: null, usesBlackShadow: false });
    expect(resolveTextProtection(box, null, [], false)).toEqual({ alpha: 1, verified: false });
    expect(() => alpha(box, [0, 0, 0], [0, 0, 0])).toThrow(expect.objectContaining({ code: 'text_protection_failed' }));
    expect(() => ColorEnvelope.fromRecipe(input, 'light', { underlay: [NaN, 0, 0], usesBlackShadow: false })).toThrow(
      expect.objectContaining({ code: 'invalid_expansion' }),
    );
  });
});

function alpha(box: ColorEnvelope, surface: Rgb, text: Rgb): number {
  const result = resolveTextProtection(box, surface, [{ text: { rgb: text, alpha: 1 }, overlays: [] }], false);
  expect(result.verified).toBe(true);
  return result.alpha;
}
