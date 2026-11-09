import { describe, expect, it } from 'vitest';
import { checkText, compactErrors, textLength } from './validation';

describe('checkText', () => {
  it('必須の空欄を指摘する', () => {
    expect(checkText('  ', { label: '名前', required: true })).toBe('名前を入力してください');
  });

  it('前後の空白を除いた文字数で上限を確かめる', () => {
    expect(checkText(' あいう ', { label: '話題', max: 3 })).toBeNull();
    expect(checkText('あいうえ', { label: '話題', max: 3 })).toBe('話題は3文字以内にしてください');
  });

  it('任意の空欄は問題なし', () => {
    expect(checkText('', { label: '話題', max: 10 })).toBeNull();
  });
});

describe('textLength', () => {
  it('サロゲートペアを1文字と数える', () => {
    expect(textLength('𠮷野家')).toBe(3);
  });
});

describe('compactErrors', () => {
  it('エラーのある項目だけを残す', () => {
    expect(compactErrors({ name: '必須です', topic: null })).toEqual({ name: '必須です' });
  });

  it('エラーがなければ null', () => {
    expect(compactErrors({ name: null })).toBeNull();
  });
});
