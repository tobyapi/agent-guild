import { describe, expect, it } from 'vitest';
import { findMentionQuery, refreshMentionQuery } from './mentionQuery';
import { activeIndexOf, stepIndex } from './mentionSelection';

describe('activeIndexOf', () => {
  const query = findMentionQuery('@', 1);

  it('いまのメンションに対する選択なら、その位置（候補の数に収める）', () => {
    expect(activeIndexOf({ query, index: 2 }, query, 5)).toBe(2);
    expect(activeIndexOf({ query, index: 7 }, query, 5)).toBe(4);
    expect(activeIndexOf({ query, index: 3 }, query, 0)).toBe(0);
  });

  it('別のメンションに対する選択なら先頭（取り直した別の値も別のメンションとして扱う）', () => {
    expect(activeIndexOf({ query: findMentionQuery('@ハ', 2), index: 2 }, query, 5)).toBe(0);
    expect(activeIndexOf({ query: findMentionQuery('@', 1), index: 2 }, query, 5)).toBe(0);
    expect(activeIndexOf({ query: null, index: 2 }, query, 5)).toBe(0);
  });

  it('↓ のあとに、同じキー操作の中で同じメンションの取り直しが届いても、選択は保たれる', () => {
    // 「@」をキー操作なしで入れた直後の最初の ↓ で起きる順番（↓ で動かす → キャレットの読み直し）
    const moved = { query, index: stepIndex(0, 1, 5) ?? 0 };
    const refreshed = refreshMentionQuery(query, '@', 1);
    expect(activeIndexOf(moved, refreshed, 5)).toBe(1);
  });

  it('文字を打ってメンションが変われば、選択は先頭に戻る', () => {
    const refreshed = refreshMentionQuery(query, '@ハ', 2);
    expect(activeIndexOf({ query, index: 3 }, refreshed, 5)).toBe(0);
  });
});

describe('stepIndex', () => {
  it('step だけ動かし、端では反対の端へ回る。候補がなければ null', () => {
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(stepIndex(0, -1, 3)).toBe(2);
    expect(stepIndex(0, 1, 0)).toBeNull();
  });
});
