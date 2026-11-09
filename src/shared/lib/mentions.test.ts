import { describe, expect, it } from 'vitest';
import { blankCodeBlocks, matchMentionAt, parseMentions, sortByNameLength } from './mentions';

const targets = [
  { id: 'hal', name: 'ハル' },
  { id: 'haruka', name: 'ハルカ' },
  { id: 'gear', name: 'ギア' },
  { id: 'bob', name: 'Bob' },
];

describe('parseMentions', () => {
  it('本文に現れた順で ID を返す', () => {
    expect(parseMentions('@ギア と @ハル に相談', targets)).toEqual(['gear', 'hal']);
  });

  it('長い名前を優先し、短い名前と取り違えない', () => {
    expect(parseMentions('@ハルカ さんへ', targets)).toEqual(['haruka']);
    expect(parseMentions('@ハルカ と @ハル', targets)).toEqual(['haruka', 'hal']);
  });

  it('NFKC と大文字小文字を無視して照合する（全角の＠・全角英字も）', () => {
    expect(parseMentions('＠ギア 見てください', targets)).toEqual(['gear']);
    expect(parseMentions('@bob と ＠ＢＯＢ', targets)).toEqual(['bob']);
  });

  it('コードブロックの中は無視する（閉じていなければ末尾まで）', () => {
    expect(parseMentions('```\n@ギア\n```\n@ハル お願い', targets)).toEqual(['hal']);
    expect(parseMentions('@ハル\n```\n@ギア', targets)).toEqual(['hal']);
  });

  it('同じ相手を何度呼んでも1回だけ返す', () => {
    expect(parseMentions('@ハル @ハル', targets)).toEqual(['hal']);
  });

  it('日本語の文中（空白なし）でも認識する', () => {
    expect(parseMentions('これを@ギアさんに', targets)).toEqual(['gear']);
  });
});

describe('matchMentionAt', () => {
  const sorted = sortByNameLength(targets);

  it('先頭の「@名前」に合う相手を、長い名前を優先して返す', () => {
    expect(matchMentionAt('@ハルカさん', sorted)?.id).toBe('haruka');
    expect(matchMentionAt('＠ｂｏｂ です', sorted)?.id).toBe('bob');
  });

  it('先頭が @ でない・知らない名前なら null', () => {
    expect(matchMentionAt('ハル', sorted)).toBeNull();
    expect(matchMentionAt('@だれか', sorted)).toBeNull();
  });
});

describe('blankCodeBlocks', () => {
  it('コードブロックを同じ長さの空白にする', () => {
    expect(blankCodeBlocks('a```x```b')).toBe(`a${' '.repeat(7)}b`);
  });
});
