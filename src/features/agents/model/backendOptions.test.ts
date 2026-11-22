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
  it('Claude の旧既定は保存されず、更新後は保存済みの上限と空欄を区別する', () => {
    const previous = specs[0]!;
    const current = [{ ...previous, default: null }];
    for (const raw of ['', '30']) {
      const stored = parseOptionValues([previous], { maxTurns: raw }).options;
      expect(stored).toEqual({});
      expect(parseOptionValues(current, optionValuesFrom(current, stored)).options).toEqual({});
    }
    const explicit = optionValuesFrom(current, { maxTurns: 30 });
    expect(parseOptionValues(current, explicit).options).toEqual({ maxTurns: 30 });
    expect(parseOptionValues(current, { maxTurns: '' }).options).toEqual({});
  });

  it('既定と違う値だけを型どおりに保存する', () => {
    const values = { maxTurns: '12', thinking: true, effort: 'medium', profile: ' work ' };
    expect(parseOptionValues(specs, values)).toEqual({
      options: { maxTurns: 12, thinking: true, profile: 'work' },
      errors: {},
    });
  });

  it('Ollama の空欄は保存せず、明示した5分は保存する', () => {
    const timeout = spec({ key: 'timeoutMinutes', type: 'number' });
    expect(parseOptionValues([timeout], { timeoutMinutes: '' }).options).toEqual({});
    expect(parseOptionValues([timeout], { timeoutMinutes: '5' }).options).toEqual({ timeoutMinutes: 5 });
  });

  it('数値でない数値・選択肢にない値は、その項目のエラーにする', () => {
    expect(parseOptionValues(specs, { maxTurns: 'たくさん', effort: 'max' }).errors).toEqual({
      maxTurns: '数値を入力してください',
      effort: '選択肢から選んでください',
    });
  });
});
