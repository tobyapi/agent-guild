// 指定フォルダのファイル道具（Windows の隔離の中で動かす版）: 範囲を OS が守ること。
// パスの判定（folder-scope.ts）を通さずに直接呼び、判定をすり抜けた場合でも範囲の外に届かないことを確かめる。
// 隔離（MXC）が使えない PC では飛ばす。
import { link, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prepareCommandSandbox } from '../command-sandbox.ts';
import { runRequest } from '../run.test-support.ts';
import type { RunRequest } from '../types.ts';
import { containerFile } from './container-file.ts';
import { fileTool } from './files.ts';
import { OUTPUT_LIMIT } from './limits.ts';
import type { LocalFileOperation } from './local-file.ts';

const available = process.platform === 'win32' && (await prepareCommandSandbox());
const signal = new AbortController().signal;
const denied = { code: 'unsupported_permission' };

describe.skipIf(!available)('指定フォルダのファイル操作（本物の MXC）', () => {
  let root: string;
  let request: RunRequest;
  const dir = (name: string) => join(root, name);
  const operation = (mode: LocalFileOperation['mode'], path: string, roots: string[], content?: string) =>
    containerFile(request, { path, roots, mode, content, limit: OUTPUT_LIMIT }, signal);
  const readRoots = () => [dir('work'), dir('project'), dir('peer')];
  const writeRoots = () => [dir('work'), dir('project')];

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'ollama-container-file-')));
    for (const name of ['work', 'state', 'project', 'peer', 'outside']) await mkdir(dir(name));
    await writeFile(join(dir('peer'), 'MEMORY.md'), 'peer private memory');
    await writeFile(join(dir('peer'), 'artifact.txt'), 'shared artifact');
    await writeFile(join(dir('outside'), 'secret.txt'), 'OUTSIDE-SECRET');
    request = {
      ...runRequest('ollama'),
      options: { enableTools: true, operationCheck: false },
      workspace: dir('work'),
      stateDir: dir('state'),
      readableDirs: [dir('project'), dir('peer')],
      writableDirs: [dir('project')],
      permissions: { ...runRequest('ollama').permissions, runCommands: false, skills: false },
    };
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('割り当てフォルダの中で、新規作成・上書き・読み取り・一覧ができる（日本語も）', async () => {
    const file = join(dir('project'), 'メモ.txt');
    expect(await operation('write_file', file, writeRoots(), '最初の内容')).toBe('written');
    expect(await operation('write_file', file, writeRoots(), '日本語の内容')).toBe('written');
    expect(await operation('read_file', file, readRoots())).toBe('日本語の内容');
    expect(await readFile(file, 'utf8')).toBe('日本語の内容');
    expect(await operation('list_files', dir('project'), readRoots())).toBe('メモ.txt');
    expect(await operation('read_file', join(dir('peer'), 'artifact.txt'), readRoots())).toBe('shared artifact');
  }, 60_000);

  it('パスの判定を通さなくても、範囲の外は読めず、書けない', async () => {
    const secret = join(dir('outside'), 'secret.txt');
    await expect(operation('read_file', secret, readRoots())).rejects.toMatchObject(denied);
    await expect(operation('write_file', secret, writeRoots(), 'overwritten')).rejects.toMatchObject(denied);
    await expect(operation('write_file', join(dir('outside'), 'new.txt'), writeRoots(), 'x')).rejects.toMatchObject(
      denied,
    );
    await expect(operation('list_files', dir('outside'), readRoots())).rejects.toMatchObject(denied);
    expect(await readFile(secret, 'utf8')).toBe('OUTSIDE-SECRET');
    await expect(readFile(join(dir('outside'), 'new.txt'))).rejects.toHaveProperty('code', 'ENOENT');
  }, 60_000);

  it('判定のあとで外へのリンクに差し替えられても、リンク先には届かない', async () => {
    // 割り当てフォルダの中の名前が、外のファイル・フォルダを指している（判定のあとに差し替えられた場合に当たる）
    await symlink(join(dir('outside'), 'secret.txt'), join(dir('project'), 'note.txt'));
    await symlink(dir('outside'), join(dir('project'), 'linked'));
    await expect(operation('read_file', join(dir('project'), 'note.txt'), readRoots())).rejects.toMatchObject(denied);
    await expect(
      operation('write_file', join(dir('project'), 'note.txt'), writeRoots(), 'overwritten'),
    ).rejects.toMatchObject(denied);
    await expect(
      operation('read_file', join(dir('project'), 'linked', 'secret.txt'), readRoots()),
    ).rejects.toMatchObject(denied);
    await expect(
      operation('write_file', join(dir('project'), 'linked', 'new.txt'), writeRoots(), 'x'),
    ).rejects.toMatchObject(denied);
    expect(await readFile(join(dir('outside'), 'secret.txt'), 'utf8')).toBe('OUTSIDE-SECRET');
    await expect(readFile(join(dir('outside'), 'new.txt'))).rejects.toHaveProperty('code', 'ENOENT');
  }, 60_000);

  it('ハードリンクのあるファイルは、中身を消す前に断る', async () => {
    await link(join(dir('outside'), 'secret.txt'), join(dir('project'), 'alias.txt'));
    await expect(operation('read_file', join(dir('project'), 'alias.txt'), readRoots())).rejects.toMatchObject(denied);
    await expect(
      operation('write_file', join(dir('project'), 'alias.txt'), writeRoots(), 'overwritten'),
    ).rejects.toMatchObject(denied);
    expect(await readFile(join(dir('outside'), 'secret.txt'), 'utf8')).toBe('OUTSIDE-SECRET');
  }, 60_000);

  it('相談相手の MEMORY.md は読ませず、相談相手のフォルダには書かせない', async () => {
    await expect(operation('read_file', join(dir('peer'), 'MEMORY.md'), readRoots())).rejects.toMatchObject(denied);
    await expect(
      operation('write_file', join(dir('peer'), 'artifact.txt'), writeRoots(), 'overwritten'),
    ).rejects.toMatchObject(denied);
    expect(await readFile(join(dir('peer'), 'artifact.txt'), 'utf8')).toBe('shared artifact');
  }, 60_000);

  it('道具としての入口からも、割り当てフォルダに保存でき、範囲の外と相談相手のメモは拒否する', async () => {
    const file = join(dir('project'), 'artifact.txt');
    expect(await fileTool(request, 'write_file', file, 'shared', signal)).toBe('written');
    expect(await fileTool(request, 'read_file', file, '', signal)).toBe('shared');
    expect(await fileTool(request, 'write_file', 'MEMORY.md', '自分のメモ', signal)).toBe('written');
    expect(await readFile(join(dir('work'), 'MEMORY.md'), 'utf8')).toBe('自分のメモ');
    await expect(fileTool(request, 'read_file', join(dir('peer'), 'MEMORY.md'), '', signal)).rejects.toThrow('MEMORY');
    await expect(fileTool(request, 'read_file', join(dir('outside'), 'secret.txt'), '', signal)).rejects.toMatchObject(
      denied,
    );
    // 作業のあとに、コードと入力を置いたフォルダを残さない
    const { readdir } = await import('node:fs/promises');
    expect(await readdir(join(dir('state'), 'container-file'))).toEqual([]);
  }, 60_000);
});
