// Seatbelt のない OS でのファイル道具（local-file.ts）: 判定した実体そのものだけを読み書きすること。
// OS に依存しない確認なので、どの OS でも動かす。
import { link, mkdir, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REAL_MACOS, runRequest } from '../run.test-support.ts';
import { fileTool } from './files.ts';
import { OUTPUT_LIMIT } from './limits.ts';
import { localFile, type LocalFileOperation } from './local-file.ts';

let root: string;
let work: string;
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'ollama-local-file-')));
  work = join(root, 'work');
  await mkdir(work);
  await mkdir(join(root, 'outside'));
  await writeFile(join(root, 'outside/secret.txt'), 'SECRET');
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const operation = (mode: LocalFileOperation['mode'], name: string, content?: string): LocalFileOperation => ({
  path: join(work, name),
  roots: [work],
  mode,
  content,
  limit: OUTPUT_LIMIT,
});
const denied = { code: 'unsupported_permission' };

describe('localFile', () => {
  it('作業場所の中で、新規作成・上書き・読み取り・一覧ができる', async () => {
    expect(await localFile(operation('write_file', 'a.txt', '最初'))).toBe('written');
    expect(await localFile(operation('write_file', 'a.txt', '短い'))).toBe('written');
    expect(await localFile(operation('read_file', 'a.txt'))).toBe('短い');
    await mkdir(join(work, 'sub'));
    expect((await localFile({ ...operation('list_files', ''), path: work })).split('\n').sort()).toEqual([
      'a.txt',
      'sub',
    ]);
  });

  it('判定のあとにリンクへ差し替えられたファイルは、読みも書きもしない', async () => {
    await writeFile(join(work, 'note.txt'), 'note');
    // 道具は実体を解決してから localFile を呼ぶ。その後で、同じ名前を外へのリンクに差し替えられた場合
    await unlink(join(work, 'note.txt'));
    await symlink(join(root, 'outside/secret.txt'), join(work, 'note.txt'));
    await expect(localFile(operation('read_file', 'note.txt'))).rejects.toMatchObject(denied);
    await expect(localFile(operation('write_file', 'note.txt', 'overwritten'))).rejects.toMatchObject(denied);
    expect(await readFile(join(root, 'outside/secret.txt'), 'utf8')).toBe('SECRET');
  });

  it('フォルダが外へのリンクに差し替えられていたら、一覧しない', async () => {
    await symlink(join(root, 'outside'), join(work, 'linked'));
    await expect(localFile(operation('list_files', 'linked'))).rejects.toMatchObject(denied);
  });

  it('ハードリンクのあるファイルは、中身を消す前に断る', async () => {
    await link(join(root, 'outside/secret.txt'), join(work, 'hard.txt'));
    await expect(localFile(operation('read_file', 'hard.txt'))).rejects.toMatchObject(denied);
    await expect(localFile(operation('write_file', 'hard.txt', 'x'))).rejects.toMatchObject(denied);
    expect(await readFile(join(root, 'outside/secret.txt'), 'utf8')).toBe('SECRET');
  });

  it('許した範囲の外のパスは、存在していても扱わない', async () => {
    const outside = { ...operation('read_file', 'x'), path: join(root, 'outside/secret.txt') };
    await expect(localFile(outside)).rejects.toMatchObject(denied);
    await expect(localFile({ ...outside, mode: 'write_file', content: 'x' })).rejects.toMatchObject(denied);
    await expect(localFile({ ...outside, mode: 'list_files', path: join(root, 'outside') })).rejects.toMatchObject(
      denied,
    );
    expect(await readFile(join(root, 'outside/secret.txt'), 'utf8')).toBe('SECRET');
  });

  it('大きすぎる読み取りと、ファイルでないものは失敗として返す（実行は止めない）', async () => {
    await writeFile(join(work, 'big.txt'), 'x'.repeat(OUTPUT_LIMIT + 1));
    await expect(localFile(operation('read_file', 'big.txt'))).rejects.toMatchObject({ code: 'bad_request' });
    await writeFile(join(work, 'file.txt'), 'x');
    await expect(localFile(operation('list_files', 'file.txt'))).rejects.toMatchObject({ code: 'bad_request' });
    await expect(localFile(operation('read_file', 'missing.txt'))).rejects.toHaveProperty('code', 'ENOENT');
  });
});

// 道具としての入口（パスの形と範囲の判定を含む）。macOS では Seatbelt の経路になるので、ここでは隔離のない OS だけを見る
describe.skipIf(REAL_MACOS)('隔離のない OS でのファイル道具', () => {
  const signal = new AbortController().signal;
  const request = () => ({
    ...runRequest('ollama'),
    options: { enableTools: true, operationCheck: false },
    workspace: work,
    stateDir: join(root, 'state'),
  });

  it('指定フォルダ（リンクの差し替えを OS で止める前提のモード）は扱わない', async () => {
    const scoped = { ...request(), writableDirs: [join(root, 'outside')], readableDirs: [join(root, 'outside')] };
    scoped.permissions = { ...scoped.permissions, runCommands: false, skills: false };
    await expect(fileTool(scoped, 'read_file', 'a.txt', '', signal)).rejects.toThrow('OS の隔離');
  });

  it('コマンドは、役割が許していても実行しない', async () => {
    const { runLocalCommand } = await import('./command.ts');
    await expect(runLocalCommand(request(), 'echo hi', signal)).rejects.toMatchObject(denied);
  });

  it.runIf(process.platform === 'win32')('Windows のネットワークパスと代替データストリームを開かない', async () => {
    await writeFile(join(work, 'a.txt'), 'a');
    for (const path of ['\\\\attacker.example\\share\\probe.txt', '//attacker.example/share/x', 'a.txt::$DATA']) {
      await expect(fileTool(request(), 'read_file', path, '', signal)).rejects.toMatchObject(denied);
      await expect(fileTool(request(), 'write_file', path, 'x', signal)).rejects.toMatchObject(denied);
    }
  });
});
