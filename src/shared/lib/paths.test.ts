import { describe, expect, it } from 'vitest';
import { folderName, isInsidePath, isSamePath } from './paths';

describe('isSamePath', () => {
  it('Windows のパスは大文字小文字・末尾の区切り・区切り文字の違いを無視する', () => {
    expect(isSamePath('C:\\Data\\Guild\\', 'c:/data/guild')).toBe(true);
    expect(isSamePath('\\\\server\\Share', '\\\\SERVER\\share\\')).toBe(true);
  });

  it('それ以外のパスは大文字小文字を区別する', () => {
    expect(isSamePath('/home/me/Guild/', '/home/me/Guild')).toBe(true);
    expect(isSamePath('/home/me/Guild', '/home/me/guild')).toBe(false);
  });
});

describe('isInsidePath', () => {
  it('入れ子だけを真にする（同じフォルダや名前の前方一致は含まない）', () => {
    expect(isInsidePath('D:\\skills\\team', 'd:/skills/')).toBe(true);
    expect(isInsidePath('D:\\skills', 'D:\\skills')).toBe(false);
    expect(isInsidePath('D:\\skills-old', 'D:\\skills')).toBe(false);
    expect(isInsidePath('/home/me/skills/a', '/home/me/skills')).toBe(true);
  });
});

describe('folderName', () => {
  it('末尾のフォルダ名を返す', () => {
    expect(folderName('D:\\skills\\unity-performance\\')).toBe('unity-performance');
    expect(folderName('/home/me/skills')).toBe('skills');
    expect(folderName('D:\\')).toBe('D:');
  });
});
