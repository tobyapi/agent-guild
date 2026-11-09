import { describe, expect, it } from 'vitest';
import { errorCode, errorMessage } from './errors';

describe('errorMessage', () => {
  it('CommandError・Error・文字列からメッセージを取り出す', () => {
    expect(errorMessage({ code: 'validation', message: '名前を入力してください' })).toBe('名前を入力してください');
    expect(errorMessage(new Error('失敗しました'))).toBe('失敗しました');
    expect(errorMessage('文字列のエラー')).toBe('文字列のエラー');
  });

  it('取り出せなければ汎用のメッセージ', () => {
    expect(errorMessage(undefined)).toBe('予期しないエラーが発生しました');
    expect(errorMessage({ message: '' })).toBe('予期しないエラーが発生しました');
  });
});

describe('errorCode', () => {
  it('契約にある code だけを返す', () => {
    expect(errorCode({ code: 'conflict', message: 'x' })).toBe('conflict');
    expect(errorCode({ code: 'teapot', message: 'x' })).toBeNull();
    expect(errorCode(new Error('x'))).toBeNull();
    expect(errorCode('conflict')).toBeNull();
  });
});
