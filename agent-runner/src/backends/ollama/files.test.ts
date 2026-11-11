import { link, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRequest } from '../run.test-support.ts';
import { fileTool } from './files.ts';

let root: string;
const signal = new AbortController().signal;
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'ollama-files-')));
  await mkdir(join(root, 'work'));
  await mkdir(join(root, 'state'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
const request = () => ({
  ...runRequest('ollama'),
  options: { enableTools: true, operationCheck: false },
  workspace: join(root, 'work'),
  stateDir: join(root, 'state'),
});

describe('Ollama file permissions', () => {
  it('書き込み権限がなくてもMEMORY.mdだけは保存できる', async () => {
    const req = request();
    req.permissions.writeFiles = false;
    await expect(fileTool(req, 'write_file', 'a.txt', 'denied', signal)).rejects.toHaveProperty(
      'code',
      'unsupported_permission',
    );
    await fileTool(req, 'write_file', 'MEMORY.md', 'メモ', signal);
    expect(await readFile(join(root, 'work/MEMORY.md'), 'utf8')).toBe('メモ');
  });

  it('リンクした親・最終ファイル・壊れたリンクから範囲外へ書かない', async () => {
    await mkdir(join(root, 'outside'));
    await writeFile(join(root, 'outside/keep'), 'keep');
    await symlink(join(root, 'outside'), join(root, 'work/link'));
    await symlink(join(root, 'outside/keep'), join(root, 'work/file'));
    await symlink(join(root, 'outside/missing'), join(root, 'work/broken'));
    for (const path of ['link/new', 'file', 'broken', '../outside/keep']) {
      await expect(fileTool(request(), 'write_file', path, 'bad', signal)).rejects.toHaveProperty(
        'code',
        'unsupported_permission',
      );
    }
    expect(await readFile(join(root, 'outside/keep'), 'utf8')).toBe('keep');
  });

  it('ハードリンクを変更しない', async () => {
    await writeFile(join(root, 'keep'), 'keep');
    await link(join(root, 'keep'), join(root, 'work/hard'));
    await expect(fileTool(request(), 'write_file', 'hard', 'bad', signal)).rejects.toHaveProperty(
      'code',
      'unsupported_permission',
    );
    expect(await readFile(join(root, 'keep'), 'utf8')).toBe('keep');
  });

  it('役割で外への書き込みを許可した場合だけ外のファイルを編集できる', async () => {
    const req = request();
    req.permissions.writeAnywhere = true;
    await fileTool(req, 'write_file', '../allowed', 'ok', signal);
    expect(await readFile(join(root, 'allowed'), 'utf8')).toBe('ok');
    await expect(fileTool(req, 'write_file', req.stateDir + '/config', 'bad', signal)).rejects.toHaveProperty(
      'code',
      'unsupported_permission',
    );
  });

  it('読み取りの追加範囲は書き込み許可にならない', async () => {
    await writeFile(join(root, 'state/data'), 'data');
    const req = { ...request(), readableDirs: [join(root, 'state')] };
    expect(await fileTool(req, 'read_file', '../state/data', '', signal)).toBe('data');
    await expect(fileTool(req, 'write_file', '../state/data', 'bad', signal)).rejects.toHaveProperty(
      'code',
      'unsupported_permission',
    );
  });
});
