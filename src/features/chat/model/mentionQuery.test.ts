import { describe, expect, it } from 'vitest';
import type { Agent } from '@/shared/types/domain';
import {
  buildMentionOptions,
  filterMentionCandidates,
  findMentionQuery,
  highlightParts,
  insertMention,
  refreshMentionQuery,
} from './mentionQuery';

describe('buildMentionOptions', () => {
  const agent = (id: string, deletedAt: number | null = null) => ({ id, name: id, deletedAt }) as Agent;

  it('削除されていないエージェントを、メンバー → チャンネル外 の順に並べる', () => {
    const options = buildMentionOptions([agent('a'), agent('b'), agent('c', 1), agent('d')], ['me', 'b', 'c']);
    expect(options.map((option) => [option.name, option.isMember])).toEqual([
      ['b', true],
      ['a', false],
      ['d', false],
    ]);
  });
});

describe('highlightParts', () => {
  it('入力に一致した部分を分ける（大文字小文字は区別しない）', () => {
    expect(highlightParts('ミハル', 'ハル')).toEqual([
      { text: 'ミ', match: false },
      { text: 'ハル', match: true },
    ]);
    expect(highlightParts('Gear', 'ge')).toEqual([
      { text: 'Ge', match: true },
      { text: 'ar', match: false },
    ]);
    expect(highlightParts('ソラ', '')).toEqual([{ text: 'ソラ', match: false }]);
  });
});

describe('findMentionQuery', () => {
  it('キャレット直前の「@」以降を取り出す', () => {
    expect(findMentionQuery('こんにちは @ハ', 8)).toEqual({ start: 6, query: 'ハ' });
  });

  it('「@」だけでも候補を出す', () => {
    expect(findMentionQuery('@', 1)).toEqual({ start: 0, query: '' });
  });

  it('日本語の文中（空白なし）でも認識し、全角の＠も扱う', () => {
    expect(findMentionQuery('これを＠ギ', 5)).toEqual({ start: 3, query: 'ギ' });
  });

  it('空白を打ったら補完を終える', () => {
    expect(findMentionQuery('@ハル こんにちは', 10)).toBeNull();
  });

  it('キャレットより後ろは見ない', () => {
    expect(findMentionQuery('@ハル', 0)).toBeNull();
  });
});

describe('refreshMentionQuery', () => {
  it('同じメンション（「@」の位置と打った文字が同じ）なら、今の値をそのまま返す', () => {
    const current = findMentionQuery('ねえ @ハ', 5);
    expect(refreshMentionQuery(current, 'ねえ @ハ', 5)).toBe(current);
  });

  it('打った文字や「@」の位置が変われば新しい値、メンションがなくなれば null', () => {
    const current = findMentionQuery('@ハ', 2);
    expect(refreshMentionQuery(current, '@ハル', 3)).toEqual({ start: 0, query: 'ハル' });
    expect(refreshMentionQuery(current, 'x@ハ', 3)).toEqual({ start: 1, query: 'ハ' });
    expect(refreshMentionQuery(current, '@ハ ', 3)).toBeNull();
    expect(refreshMentionQuery(null, '@', 1)).toEqual({ start: 0, query: '' });
  });
});

describe('filterMentionCandidates', () => {
  const candidates = [{ name: 'ソラ' }, { name: 'ハル' }, { name: 'ミハル' }, { name: 'Gear' }];

  it('前方一致を先に、部分一致を後に並べる', () => {
    expect(filterMentionCandidates(candidates, 'ハル').map((c) => c.name)).toEqual(['ハル', 'ミハル']);
  });

  it('大文字小文字を区別しない', () => {
    expect(filterMentionCandidates(candidates, 'ge').map((c) => c.name)).toEqual(['Gear']);
  });

  it('空の入力では全員を元の順に返し、件数を制限する', () => {
    expect(filterMentionCandidates(candidates, '', 2).map((c) => c.name)).toEqual(['ソラ', 'ハル']);
  });
});

describe('insertMention', () => {
  it('入力中の部分を「@名前 」に置き換え、キャレットをその後ろに置く', () => {
    const text = 'ねえ @ハ どう？';
    const result = insertMention(text, { start: 3, query: 'ハ' }, 5, 'ハル');
    expect(result).toEqual({ text: 'ねえ @ハル  どう？', caret: 7 });
  });
});
