// 「名前の一覧だけ」の親フォルダの下で、関係のないフォルダを隠す規則（どの OS でも動く検査）。
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { containerConfig, enumerablePaths, type CommandScope } from './policy.ts';
import { childDirectories, hiddenSiblings, systemDirs } from './siblings.ts';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'guild-sandbox-siblings-')));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const users = join(root, 'Users');
const home = join(users, 'me');
const work = join(home, 'data', 'agents', 'a1', 'work');
const peer = join(home, 'data', 'agents', 'a0', 'work');
const state = join(home, 'data', 'agents', 'a1', 'state', 'command-home');
const windows = join(root, 'Windows');
const programs = join(root, 'Program Files');
const local = join(home, 'AppData', 'Local');
const env = { SystemRoot: windows, ProgramFiles: programs, LocalAppData: local };

/** 決まった中身を返す、フォルダの一覧（実際のディスクは読まない） */
const tree: Record<string, string[]> = {
  [root]: ['Users', 'Windows', 'Program Files', 'Secret Projects'],
  [users]: ['me', 'other'],
  [home]: ['data', 'Documents', '.ssh', 'AppData'],
  [join(home, 'data')]: ['agents', 'backups'],
  [join(home, 'data', 'agents')]: ['a0', 'a1', 'a2'],
  [join(home, 'data', 'agents', 'a1')]: ['work', 'state'],
  [join(home, 'data', 'agents', 'a0')]: ['work', 'state'],
  [local]: ['Packages', 'Temp'],
  [programs]: ['Git', 'Other App'],
};
const list = (dir: string): string[] => (tree[dir] ?? []).map((name) => join(dir, name));

describe('hiddenSiblings', () => {
  const granted = [work, state, peer];
  const hidden = hiddenSiblings(enumerablePaths(granted), granted, env, list);

  it('親フォルダの直下のうち、許可した場所へ続かないフォルダを隠す', () => {
    expect(hidden).toEqual(
      expect.arrayContaining([
        join(root, 'Secret Projects'),
        join(users, 'other'),
        join(home, 'Documents'),
        join(home, '.ssh'),
        join(home, 'AppData'),
        join(home, 'data', 'backups'),
        // ほかのエージェントの作業場所と、相談元の管理領域
        join(home, 'data', 'agents', 'a2'),
        join(home, 'data', 'agents', 'a0', 'state'),
      ]),
    );
    expect(hidden).toHaveLength(8);
  });

  it('許可した場所・そこへ続く親フォルダ・システムのフォルダは隠さない', () => {
    for (const path of [work, peer, state, dirname(work), home, users, windows, programs]) {
      expect(hidden).not.toContain(path);
    }
  });

  it('システムのフォルダの中は、道具へ続く親フォルダでも兄弟を隠さない（Windows の部品が要る）', () => {
    const git = join(programs, 'Git', 'cmd');
    const withTool = hiddenSiblings(enumerablePaths([work, git]), [work, git], env, list);
    expect(withTool).not.toContain(join(programs, 'Other App'));
    expect(withTool).toContain(join(home, 'Documents'));
  });

  it('隔離が自分の置き場に使うパッケージのフォルダは隠さない（環境変数の名前の大文字小文字は問わない）', () => {
    const tool = join(local, 'Programs', 'Python');
    const withTool = hiddenSiblings(enumerablePaths([work, tool]), [work, tool], env, list);
    expect(systemDirs(env)).toContain(join(local, 'Packages'));
    expect(withTool).not.toContain(join(local, 'Packages'));
    expect(withTool).toContain(join(local, 'Temp'));
  });
});

describe('childDirectories', () => {
  it('本物のフォルダだけを挙げ、ファイルとリンクは挙げない。読めないフォルダは空', () => {
    const parent = join(root, 'listing');
    mkdirSync(join(parent, 'real'), { recursive: true });
    writeFileSync(join(parent, 'file.txt'), 'x');
    symlinkSync(join(parent, 'real'), join(parent, 'link'), 'junction');
    expect(childDirectories(parent)).toEqual([join(parent, 'real')]);
    expect(childDirectories(join(root, 'missing'))).toEqual([]);
  });
});

describe('containerConfig の拒否と一覧', () => {
  const memory = join(peer, 'MEMORY.md');
  const scope: CommandScope = { cwd: work, writable: [work], readable: [peer], home: state, denied: [memory] };
  type Shape = {
    filesystem: { deniedPaths: string[] };
    processContainer: { filesystem: { enumeratePaths: string[] } };
  };
  const shape = (config: unknown) => config as Shape;

  it('コマンドでは、親フォルダを一覧させ、関係のないフォルダと指定された場所を拒否する', () => {
    const config = shape(containerConfig(scope, 'cmd', { ...env, PATH: '' }, 1000, list));
    expect(config.processContainer.filesystem.enumeratePaths).toContain(home);
    expect(config.filesystem.deniedPaths).toContain(memory);
    expect(config.filesystem.deniedPaths).toContain(join(home, 'Documents'));
    expect(config.filesystem.deniedPaths).not.toContain(dirname(work));
  });

  it('決まったプログラムだけを動かすとき（tools: false）は、親フォルダも一覧させない', () => {
    const config = shape(containerConfig({ ...scope, tools: false }, 'cmd', { ...env, PATH: '' }, 1000, list));
    expect(config.processContainer.filesystem.enumeratePaths).toEqual([]);
    expect(config.filesystem.deniedPaths).toEqual([memory]);
  });
});
