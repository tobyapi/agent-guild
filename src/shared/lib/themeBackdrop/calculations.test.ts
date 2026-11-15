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
const recipe = cases[0].input;

describe('Recipe calculations: same Rust inputs', () => {
  it.each([
    [[200, 100], 18],
    [[201, 101], 32],
    [[400, 200], 50],
  ] as const)('pattern area %j -> %i', (viewport, expected) => {
    const layer = { cost: { ...zero, dom: 3, definitions: 1 }, patterns: [{ width: 100, height: 50, primitives: 2 }] };
    expect(validateRecipeCost(recipe, viewport, zero, [layer])).toEqual({
      ...zero,
      primitives: expected,
      dom: 3,
      definitions: 1,
    });
    expect(() => validateRecipeCost(recipe, [10000, 10000], zero, [layer])).toThrow(
      expect.objectContaining({ code: 'primitive_budget_exceeded' }),
    );
  });

  it('adds all layers and patterns without resetting base', () => {
    const input = { ...recipe, layers: [recipe.layers[0], recipe.layers[0]] };
    const cost = { primitives: 500, dom: 100, definitions: 8, movingGroups: 1 };
    const patterns = [2, 3].map((primitives) => ({ width: 100, height: 100, primitives }));
    expect(
      validateRecipeCost(input, [100, 100], { primitives: 20, dom: 10, definitions: 1, movingGroups: 0 }, [
        { cost, patterns },
        { cost, patterns: [] },
      ]),
    ).toEqual({ primitives: 1040, dom: 210, definitions: 17, movingGroups: 2 });
  });

  it('accepts limits and rejects each overrun and invalid expansion', () => {
    const boundary = { primitives: 2000, dom: 400, definitions: 32, movingGroups: 2 };
    expect(validateRecipeCost(recipe, [1920, 1080], boundary, [{ cost: zero, patterns: [] }])).toEqual(boundary);
    for (const [key, code] of Object.entries({
      primitives: 'primitive_budget_exceeded',
      dom: 'dom_budget_exceeded',
      definitions: 'definition_budget_exceeded',
      movingGroups: 'motion_budget_exceeded',
    })) {
      const cost = { ...boundary, [key]: boundary[key as keyof DrawingCost] + 1 };
      expect(() => validateRecipeCost(recipe, [1, 1], cost, [{ cost: zero, patterns: [] }])).toThrow(
        expect.objectContaining({ field: 'layers', code }),
      );
    }
    expect(() => validateRecipeCost(recipe, [NaN, 1], zero, [])).toThrow(
      expect.objectContaining({ code: 'invalid_expansion' }),
    );
    const patterns = [{ width: Number.MIN_VALUE, height: Number.MIN_VALUE, primitives: 1 }];
    expect(() => validateRecipeCost(recipe, [1920, 1080], zero, [{ cost: zero, patterns }])).toThrow(
      expect.objectContaining({ code: 'primitive_budget_exceeded' }),
    );
  });

  it.each(cases.filter((c) => c.expected.valid))('$name alpha agrees with Rust comparison', ({ input }) => {
    for (const [scheme, surface, text, oldAlpha, newAlpha] of [
      ['light', [1, 1, 1], [0, 0, 0], 0.462, 0.18],
      ['dark', [0, 0, 0], [1, 1, 1], 0.417, 0.417],
    ] as const) {
      const old = ColorEnvelope.fromRecipe(input, scheme, { underlay: null, usesBlackShadow: true });
      const current = ColorEnvelope.fromRecipe(input, scheme, { underlay: surface, usesBlackShadow: false });
      const shadow = ColorEnvelope.fromRecipe(input, scheme, { underlay: surface, usesBlackShadow: true });
      expect(alpha(old, surface, text)).toBe(oldAlpha);
      expect(alpha(current, surface, text)).toBe(newAlpha);
      expect(alpha(current, surface, text)).toBeLessThanOrEqual(alpha(shadow, surface, text));
    }
  });

  it('includes red/green midpoint and rejects unresolved or unreadable protection', () => {
    const input = structuredClone(recipe);
    input.palette.light = ['#ff0000', '#00ff00', '#ff0000', '#00ff00'];
    const box = ColorEnvelope.fromRecipe(input, 'light', { underlay: null, usesBlackShadow: false });
    expect(box.corners()[0]).toEqual([0, 0, 0]);
    expect(box.corners()[7]).toEqual([1, 1, 0]);
    expect(alpha(box, [0, 0, 0], [0.5, 0.5, 0])).toBeGreaterThan(0);
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
