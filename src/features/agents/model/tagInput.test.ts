import { describe, expect, it } from 'vitest';
import { commitTagText, promoteTag, removeTag } from './tagInput';

describe('commitTagText', () => {
  it('空白・カンマ・読点で区切って足し、重複は黙ってまとめる', () => {
    expect(commitTagText(['作業者'], ' リサーチ, 調査 Review，review 作業者')).toEqual({
      ok: true,
      tags: ['作業者', 'リサーチ', '調査', 'Review'],
    });
    expect(commitTagText(['作業者'], '   ')).toEqual({ ok: true, tags: ['作業者'] });
    expect(commitTagText([], '設計、レビュー')).toEqual({ ok: true, tags: ['設計', 'レビュー'] });
  });

  it('規則に反するタグがあれば何も足さずに理由を返す', () => {
    expect(commitTagText([], '設計 #レビュー')).toEqual({ ok: false, error: '「#レビュー」: タグに空白・#・,・@ は使えません' });
    expect(commitTagText([], 'あ'.repeat(17))).toMatchObject({ ok: false });
  });

  it('8 個を超えるなら断る', () => {
    const eight = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(commitTagText(eight, 'i')).toEqual({ ok: false, error: 'タグは 8 個までにしてください' });
    expect(commitTagText(eight, 'A')).toEqual({ ok: true, tags: eight });
  });
});

describe('removeTag / promoteTag', () => {
  it('外す・先頭にする', () => {
    expect(removeTag(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
    expect(promoteTag(['a', 'b', 'c'], 2)).toEqual(['c', 'a', 'b']);
    expect(promoteTag(['a'], 5)).toEqual(['a']);
  });
});
