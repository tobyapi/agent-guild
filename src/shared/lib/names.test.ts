import { describe, expect, it } from 'vitest';
import { checkMemberName, MEMBER_NAME_MAX } from './names';

describe('checkMemberName', () => {
  it('問題がなければ null', () => {
    expect(checkMemberName(' ハル ', ['ソラ'])).toBeNull();
  });

  it('空欄と長すぎる名前を指摘する', () => {
    expect(checkMemberName('  ', [])).toBe('名前を入力してください');
    expect(checkMemberName('あ'.repeat(MEMBER_NAME_MAX + 1), [])).toBe('名前は 32 文字以内にしてください');
  });

  it('空白（全角も）と @ は使えない', () => {
    for (const name of ['ハル カ', 'ハル　カ', 'ハル@', '＠ハル']) {
      expect(checkMemberName(name, [])).toBe('名前に空白や @ は使えません');
    }
  });

  it('NFKC と大文字小文字を無視して重複を見つける', () => {
    expect(checkMemberName('ＢＯＢ', ['bob'])).toBe('その名前はすでに使われています');
    expect(checkMemberName('Hal', ['hal'])).not.toBeNull();
  });
});
