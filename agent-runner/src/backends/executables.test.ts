import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findInDirs, overridePath, pathDirs, withPathDirs } from './executables.ts';

describe('PATH から実行ファイルを探す部品', () => {
  it('PATH のフォルダは空と重複を除き、Windows の Path も読む', () => {
    expect(pathDirs({ PATH: ['a', '', 'b', 'a'].join(delimiter) })).toEqual(['a', 'b']);
    expect(pathDirs({ Path: 'c' })).toEqual(['c']);
    expect(pathDirs({})).toEqual([]);
  });

  it('フォルダの順に探し、同じフォルダでは名前の順', () => {
    const root = mkdtempSync(join(tmpdir(), 'guild-exe-'));
    for (const file of ['b/tool.cmd', 'b/tool.exe', 'c/tool.exe']) {
      mkdirSync(join(root, file, '..'), { recursive: true });
      writeFileSync(join(root, file), '');
    }
    const dirs = [join(root, 'a'), join(root, 'b'), join(root, 'c')];
    expect(findInDirs(dirs, ['tool.exe', 'tool.cmd'])).toBe(join(root, 'b', 'tool.exe'));
    expect(findInDirs(dirs, ['other.exe'])).toBeNull();
    expect(overridePath(join(root, 'c', 'tool.exe'))).toBe(join(root, 'c', 'tool.exe'));
    expect(overridePath(join(root, 'nope.exe'))).toBeNull();
    expect(overridePath('  ')).toBeUndefined();
  });

  it('子に渡す PATH の先頭にフォルダを足す（名前は元のまま。足すものがなければ親の環境をそのまま使う）', () => {
    expect(withPathDirs(['x', 'y'], { Path: 'base', HOME: 'h' })).toEqual({
      Path: ['x', 'y', 'base'].join(delimiter),
      HOME: 'h',
    });
    expect(withPathDirs(['x'], {})).toEqual({ PATH: 'x' });
    expect(withPathDirs([], { PATH: 'base' })).toBeUndefined();
  });
});
