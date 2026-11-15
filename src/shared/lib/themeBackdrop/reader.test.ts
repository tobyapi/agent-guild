import { describe, expect, it } from 'vitest';
import { behaviorFixture } from '../behaviorFixtures.test-support';
import { parseRecipeJson, RecipeValidationError, validateRecipeStructure } from './index';

interface Case {
  name: string;
  input: Record<string, unknown>;
  expected: { valid: boolean; validationErrors: { field: string; code: string }[] };
}
const cases = behaviorFixture<Case[]>('theme-backdrop-recipe.json');

describe('Recipe reader: Rust contract', () => {
  it.each(cases)('$name', ({ input, expected }) => {
    const original = JSON.stringify(input);
    const parsed = parseRecipeJson(original);
    const errors = diagnostics(() => validateRecipeStructure(parsed));
    expect(errors).toEqual(expected.validationErrors);
    expect(errors.length === 0).toBe(expected.valid);
    expect(JSON.stringify(parsed)).toBe(original);
  });

  it('fixes numeric, title, required and safe parent diagnostics', () => {
    for (const [field, value, code] of [
      ['seed', 1.5, 'invalid_type'],
      ['seed', NaN, 'invalid_type'],
      ['seed', 4294967296, 'out_of_range'],
      ['title', '', 'invalid_title'],
      ['title', '😀'.repeat(41), 'invalid_title'],
      ['title', 'a\u0085', 'invalid_title'],
    ] as const) {
      const recipe = { ...cases[0]!.input, [field]: value };
      expect(diagnostics(() => validateRecipeStructure(recipe))).toEqual([{ field, code }]);
    }
    const recipe = structuredClone(cases[0]!.input);
    delete recipe.title;
    expect(diagnostics(() => validateRecipeStructure(recipe))).toEqual([{ field: 'title', code: 'required' }]);
    recipe['untrusted-secret-key'] = 'private';
    expect(diagnostics(() => validateRecipeStructure(recipe))).toEqual([{ field: '$', code: 'additional_property' }]);
    expect(() => validateRecipeStructure({ ...cases[0]!.input, title: '😀'.repeat(40) })).not.toThrow();
  });
});

function diagnostics(action: () => unknown): { field: string; code: string }[] {
  try {
    action();
    return [];
  } catch (error) {
    if (!(error instanceof RecipeValidationError)) throw error;
    return [{ field: error.field, code: error.code }];
  }
}
