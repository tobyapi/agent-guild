import { describe, expect, it } from 'vitest';
import { behaviorFixture } from '../behaviorFixtures.test-support';
import { ColorEnvelope, parseRecipeJson, resolveTextProtection, validateRecipeCost } from './index';
import type { ColorExpansion, DrawingCost, LayerExpansion, Rgb } from './index';

interface Recipe {
  palette: Record<string, string[]>;
  layers: { motion: string }[];
}
const recipes = behaviorFixture<{ name: string; input: Recipe }[]>('theme-backdrop-recipe.json');
function recipe(name: string): Recipe {
  const value = recipes.find((r) => r.name === name);
  if (!value) throw new Error(`Missing recipe ${name}`);
  return structuredClone(value.input);
}
interface RawCase {
  name: string;
  input: { text: string; count: number }[];
  expected: { validationErrors: { field: string; code: string }[]; value?: unknown };
}
interface CostCase {
  name: string;
  input: { recipe: string; viewport: number[]; base: DrawingCost; layers: LayerExpansion[] };
  expected: { validationErrors: { field: string; code: string }[]; cost?: DrawingCost };
}
interface ColorCase {
  name: string;
  input: { recipe: string; scheme: string; palette?: string[]; surface: Rgb; text: Rgb; expansion: ColorExpansion };
  expected: { alpha: number; verified: boolean; low?: Rgb; high?: Rgb; contains?: Rgb };
}

describe('Recipe shared behavior fixtures', () => {
  it.each(behaviorFixture<RawCase[]>('theme-backdrop-raw.json'))('$name', ({ input, expected }) => {
    const raw = input.map(({ text, count }) => text.repeat(count)).join('');
    if (expected.validationErrors.length) {
      expect(() => parseRecipeJson(raw)).toThrow(expect.objectContaining(expected.validationErrors[0]));
    } else {
      expect(parseRecipeJson(raw)).toEqual(expected.value);
    }
  });

  it.each(behaviorFixture<CostCase[]>('theme-backdrop-cost.json'))('$name', ({ input, expected }) => {
    const value = recipe(input.recipe);
    value.layers = input.layers.map(() => structuredClone(value.layers[0]!));
    const original = structuredClone(value);
    const run = () => validateRecipeCost(value, input.viewport, input.base, input.layers);
    if (expected.validationErrors.length) {
      expect(run).toThrow(expect.objectContaining(expected.validationErrors[0]));
    } else {
      expect(run()).toEqual(expected.cost);
    }
    expect(value).toEqual(original);
  });

  it.each(behaviorFixture<ColorCase[]>('theme-backdrop-color.json'))('$name', ({ input, expected }) => {
    const value = recipe(input.recipe);
    if (input.palette) value.palette[input.scheme] = input.palette;
    const original = structuredClone(value);
    const box = ColorEnvelope.fromRecipe(value, input.scheme, input.expansion);
    expect(
      resolveTextProtection(box, input.surface, [{ text: { rgb: input.text, alpha: 1 }, overlays: [] }], false),
    ).toEqual({ alpha: expected.alpha, verified: expected.verified });
    if (expected.low && expected.high && expected.contains) {
      expect(box.corners()[0]).toEqual(expected.low);
      expect(box.corners()[7]).toEqual(expected.high);
      expected.contains.forEach((v, c) => {
        expect(v).toBeGreaterThanOrEqual(box.corners()[0]![c]!);
        expect(v).toBeLessThanOrEqual(box.corners()[7]![c]!);
      });
    }
    expect(value).toEqual(original);
  });
});
