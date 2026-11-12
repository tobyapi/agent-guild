import { describe, expect, it } from 'vitest';
import { ACCENTS, accentName, parseAccent } from './accent';

describe('parseAccent', () => {
  it('保存されていた値を読み、なければ・知らない値なら既定（灯の金）にする', () => {
    expect(parseAccent('sky')).toBe('sky');
    expect(parseAccent('silver')).toBe('silver');
    expect(parseAccent(null)).toBe('default');
    expect(parseAccent('magenta')).toBe('default');
    expect(parseAccent('')).toBe('default');
  });
});

describe('accentName', () => {
  it('どの色にも名前がある', () => {
    for (const accent of ACCENTS) expect(accentName(accent)).not.toBe('');
  });
});
