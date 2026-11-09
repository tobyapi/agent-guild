import { describe, expect, it } from 'vitest';
import { isExternalUrl } from './links';

describe('isExternalUrl', () => {
  it('http と https のリンクだけを開いてよいとする', () => {
    expect(isExternalUrl('https://example.com/?a=1&b=2')).toBe(true);
    expect(isExternalUrl('HTTP://Example.com')).toBe(true);
    for (const url of [
      'javascript:alert(1)',
      'mailto:a@b.c',
      'file:///C:/x',
      'https://',
      'https:///x',
      'https://a b',
    ]) {
      expect(isExternalUrl(url)).toBe(false);
    }
  });
});
