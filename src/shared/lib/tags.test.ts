import { describe, expect, it } from 'vitest';
import { checkTag, checkTags, cleanTags, TAG_COUNT_MAX } from './tags';

describe('checkTag', () => {
  it('前後の空白を除いて 1〜16 文字なら通す', () => {
    expect(checkTag(' リサーチ ')).toBeNull();
    expect(checkTag('あ'.repeat(16))).toBeNull();
  });

  it('空・長すぎる・使えない文字を含むものを断る', () => {
    expect(checkTag('  ')).toBe('タグを入力してください');
    expect(checkTag('あ'.repeat(17))).toContain('16 文字以内');
    for (const bad of ['a b', '#設計', 'a,b', 'a@b', '＃設計', 'a，b', 'a＠b']) {
      expect(checkTag(bad)).toBe('タグに空白・#・,・@ は使えません');
    }
  });
});

describe('cleanTags', () => {
  it('NFKC＋大文字小文字無視で重複をまとめ、最初の表記を残す', () => {
    expect(cleanTags(['Review', ' review ', 'ＲＥＶＩＥＷ', '設計'])).toEqual(['Review', '設計']);
  });
});

describe('checkTags', () => {
  it('重複をまとめたあとの個数で上限を判定する', () => {
    const many = Array.from({ length: TAG_COUNT_MAX }, (_, index) => `t${index}`);
    expect(checkTags([...many, 'T0'])).toBeNull();
    expect(checkTags([...many, 'extra'])).toBe(`タグは ${TAG_COUNT_MAX} 個までにしてください`);
  });

  it('問題のあるタグを名指しする', () => {
    expect(checkTags(['設計', 'a b'])).toBe('「a b」: タグに空白・#・,・@ は使えません');
  });

  it('0 個でもよい', () => {
    expect(checkTags([])).toBeNull();
  });
});
