import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
  // テストは DOM のない node 環境で動くので、DOMPurify が使えないときの振る舞い（安全側）を確かめる
  it('DOMPurify が使えない環境では全体をエスケープして返す', () => {
    expect(sanitizeHtml('<img src=x onerror="alert(1)"><p>本文</p>')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&lt;p&gt;本文&lt;/p&gt;',
    );
  });
});
