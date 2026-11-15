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

  it.each([
    ['{"a":1,"\\u0061":2}', 'duplicate_key'],
    ['{"layers":[{"x":0,"x":1}]}', 'duplicate_key'],
    ['['.repeat(9) + ']'.repeat(9), 'nesting_too_deep'],
    ['{"x":1} trailing', 'invalid_json'],
    ['```json\n{}\n```', 'invalid_json'],
    ['{"x":1,}', 'invalid_json'],
    ['[01]', 'invalid_json'],
    ['1e999', 'invalid_json'],
    ['"\\ud800"', 'invalid_json'],
    [' '.repeat(32769), 'input_too_large'],
  ])('rejects raw %s', (input, code) => {
    expect(diagnostics(() => parseRecipeJson(input))).toEqual([{ field: '$', code }]);
  });

  it('accepts exact byte/depth boundaries and escaped strings', () => {
    expect(parseRecipeJson(' '.repeat(32766) + '{}')).toEqual({});
    expect(parseRecipeJson('['.repeat(8) + ']'.repeat(8))).toEqual([[[[[[[[]]]]]]]]);
    expect(parseRecipeJson('{"a":"a\\u0022b","emoji":"\\ud83d\\ude00"}')).toEqual({ a: 'a"b', emoji: '😀' });
    expect(diagnostics(() => parseRecipeJson('"' + 'あ'.repeat(10923) + '"'))[0]!.code).toBe('input_too_large');
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
