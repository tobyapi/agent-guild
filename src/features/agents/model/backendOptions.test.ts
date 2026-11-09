import { describe, expect, it } from 'vitest';
import type { OptionSpec } from '@/shared/types/domain';
import { isCustomized, optionValuesFrom, parseOptionValues } from './backendOptions';

const spec = (overrides: Partial<OptionSpec> & Pick<OptionSpec, 'key' | 'type'>): OptionSpec => ({
  label: overrides.key,
  description: '',
  choices: [],
  default: null,
  ...overrides,
});

const specs: OptionSpec[] = [
  spec({ key: 'maxTurns', type: 'number', default: 30 }),
  spec({ key: 'thinking', type: 'boolean', default: false }),
  spec({ key: 'effort', type: 'select', choices: ['low', 'medium', 'high'], default: 'medium' }),
  spec({ key: 'profile', type: 'string' }),
];

describe('optionValuesFrom', () => {
  it('スキーマにあるキーだけを入力値にする（数値は文字列に）', () => {
    expect(optionValuesFrom(specs, { maxTurns: 10, thinking: true, unknown: 1, effort: 3 })).toEqual({
      maxTurns: '10',
      thinking: true,
      effort: '3',
    });
  });
});

describe('isCustomized', () => {
  it('空欄と既定値は既定のまま、違う値なら変更あり', () => {
    expect(isCustomized(specs[0]!, { maxTurns: '' })).toBe(false);
    expect(isCustomized(specs[0]!, { maxTurns: '30' })).toBe(false);
    expect(isCustomized(specs[0]!, { maxTurns: '12' })).toBe(true);
    expect(isCustomized(specs[1]!, { thinking: false })).toBe(false);
  });
});

describe('parseOptionValues', () => {
  it('既定と違う値だけを型どおりに保存する', () => {
    const values = { maxTurns: '12', thinking: true, effort: 'medium', profile: ' work ' };
    expect(parseOptionValues(specs, values)).toEqual({
      options: { maxTurns: 12, thinking: true, profile: 'work' },
      errors: {},
    });
  });

  it('数値でない数値・選択肢にない値は、その項目のエラーにする', () => {
    expect(parseOptionValues(specs, { maxTurns: 'たくさん', effort: 'max' }).errors).toEqual({
      maxTurns: '数値を入力してください',
      effort: '選択肢から選んでください',
    });
  });
});
