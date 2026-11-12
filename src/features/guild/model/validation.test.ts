import { describe, expect, it } from 'vitest';
import { DEFAULT_GUILD } from '@/shared/lib/guild';
import { validateGuild } from './validation';

const named = (name: string) => ({ ...DEFAULT_GUILD, name });

describe('validateGuild', () => {
  it('空の名前と32文字までの名前は通す（前後の空白は数えない）', () => {
    expect(validateGuild(named(''))).toEqual({});
    expect(validateGuild(named(` ${'あ'.repeat(32)} `))).toEqual({});
  });

  it('33文字からは名前の欄のエラー', () => {
    expect(validateGuild(named('あ'.repeat(33)))).toEqual({ name: 'ギルド名は32文字以内にしてください' });
  });
});
