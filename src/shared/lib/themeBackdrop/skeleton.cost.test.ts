import { describe, expect, it } from 'vitest';
import { behaviorFixture } from '../behaviorFixtures.test-support';
import { buildBackdropSkeleton, validateRecipeCost } from './index';
import type { BackdropLayer, DrawingCost, LayerExpansion } from './index';

interface Recipe {
  layers: BackdropLayer[];
}
interface CostCase {
  name: string;
  input: { recipe: string; viewport: number[]; base: DrawingCost; layers: LayerExpansion[] };
  expected: { cost?: DrawingCost };
}
const recipes = behaviorFixture<{ name: string; input: Recipe }[]>('theme-backdrop-recipe.json');
const fixtures = behaviorFixture<CostCase[]>('theme-backdrop-cost.json').filter((item) =>
  ['pattern-18', 'pattern-32', 'pattern-50', 'sum-1040'].includes(item.name),
);
function recipe(name = 'tile-turtle-none'): Recipe {
  return structuredClone(recipes.find((item) => item.name === name)!.input);
}

describe('SVG skeleton cost connection', () => {
  it.each(fixtures)('uses the shared $name expansion counts plus actual shell nodes', ({ input, expected }) => {
    const value = recipe(input.recipe);
    value.layers = input.layers.map(() => ({ ...value.layers[0]! }));
    // Convert CSS-pixel periods to fixed viewBox units; repetition counts are invariant.
    const content = input.layers.map((layer) => ({
      cost: { ...layer.cost },
      patterns: layer.patterns.map((p) => ({
        width: (p.width * 1000) / input.viewport[0]!,
        height: (p.height * 1000) / input.viewport[1]!,
        primitives: p.primitives,
      })),
    }));
    const before = structuredClone(content);
    const result = buildBackdropSkeleton(value, content);
    const fixtureTotal = validateRecipeCost(
      value,
      [1000, 1000],
      { ...input.base, dom: input.base.dom + 1 },
      result.expansions,
    );
    expect(fixtureTotal).toEqual({ ...expected.cost, dom: expected.cost!.dom + 1 + 3 * value.layers.length });
    expect(result.cost.primitives).toBe(expected.cost!.primitives - input.base.primitives + 4);
    expect(result.cost).toEqual(validateRecipeCost(value, [1000, 1000], result.baseCost, result.expansions));
    expect(content).toEqual(before);
    result.expansions[0]!.cost.dom = 0;
    result.expansions[0]!.patterns[0]!.primitives = 999;
    expect(content).toEqual(before);
  });

  it('counts the shell before checking component budgets and rejects invalid metadata', () => {
    const input = recipe();
    const content: LayerExpansion = {
      cost: { primitives: 0, dom: 399, definitions: 0, movingGroups: 0 },
      patterns: [],
    };
    expect(() => buildBackdropSkeleton(input, [content])).toThrow(
      expect.objectContaining({ field: 'layers', code: 'dom_budget_exceeded' }),
    );
    expect(() => buildBackdropSkeleton(input, [])).toThrow(expect.objectContaining({ code: 'invalid_expansion' }));
    content.cost.dom = -1;
    expect(() => buildBackdropSkeleton(input, [content])).toThrow(
      expect.objectContaining({ code: 'invalid_expansion' }),
    );
    content.cost.dom = 0;
    content.patterns = [{ width: 0, height: 50, primitives: 2 }];
    expect(() => buildBackdropSkeleton(input, [content])).toThrow(
      expect.objectContaining({ code: 'invalid_expansion' }),
    );
  });
});
