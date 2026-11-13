import { describe, expect, it } from 'vitest';
import { parseAutoCheck, serializeAutoCheck } from './autoCheck';

describe('parseAutoCheck', () => {
  it('保存した値を読み戻せる', () => {
    expect(parseAutoCheck(serializeAutoCheck(true))).toBe(true);
    expect(parseAutoCheck(serializeAutoCheck(false))).toBe(false);
  });

  it('値がない（以前の版）・知らない値ならオン', () => {
    expect(parseAutoCheck(null)).toBe(true);
    expect(parseAutoCheck('')).toBe(true);
    expect(parseAutoCheck('maybe')).toBe(true);
  });
});
