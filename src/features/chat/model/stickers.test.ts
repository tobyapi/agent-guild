import { describe, expect, it } from 'vitest';
import { insertAtSelection, STICKERS } from './stickers';

describe('insertAtSelection', () => {
  it('キャレットの位置に差し込み、キャレットを差し込んだ文の直後へ置く', () => {
    expect(insertAtSelection('前後', 1, 1, '中')).toEqual({ text: '前中後', caret: 2 });
  });

  it('空の下書きにも差し込める', () => {
    expect(insertAtSelection('', 0, 0, '続きをお願いします。')).toEqual({ text: '続きをお願いします。', caret: 10 });
  });

  it('選択範囲は差し込む文で置き換える（逆向きの範囲も同じ）', () => {
    expect(insertAtSelection('abcdef', 1, 4, 'X')).toEqual({ text: 'aXef', caret: 2 });
    expect(insertAtSelection('abcdef', 4, 1, 'X')).toEqual({ text: 'aXef', caret: 2 });
  });

  it('範囲外や不正な位置は文字列の中に収める', () => {
    expect(insertAtSelection('ab', 10, 10, 'X')).toEqual({ text: 'abX', caret: 3 });
    expect(insertAtSelection('ab', -3, -1, 'X')).toEqual({ text: 'Xab', caret: 1 });
    expect(insertAtSelection('ab', Number.NaN, Number.NaN, 'X')).toEqual({ text: 'abX', caret: 3 });
  });
});

describe('STICKERS', () => {
  it('8 件で、id は重ならない', () => {
    expect(STICKERS).toHaveLength(8);
    expect(new Set(STICKERS.map((sticker) => sticker.id)).size).toBe(STICKERS.length);
  });
});
