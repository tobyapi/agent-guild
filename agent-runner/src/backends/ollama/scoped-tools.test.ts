import { mkdtemp, mkdir, writeFile, readFile, symlink, link, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { runRequest } from '../run.test-support.ts';
import { executeTool, sandbox } from './tools.ts';
const dirs: string[] = [];
afterEach(async () => {
  for (const path of dirs.splice(0)) await rm(path, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'ollama-scoped-tools-'));
  dirs.push(root);
  const workspace = join(root, 'work');
  const stateDir = join(root, 'state');
  await mkdir(workspace);
  await mkdir(stateDir);
  return { ...runRequest('ollama'), workspace, stateDir, options: { enableTools: true, operationCheck: false } };
}

it.skipIf(process.platform !== 'darwin')('指定フォルダの実読み書きと相談メモ保護、コマンドの拒否', async () => {
  const request = await fixture();
  const project = join(request.workspace, '../project');
  const peer = join(request.workspace, '../peer');
  await mkdir(project);
  await mkdir(peer);
  await writeFile(join(peer, 'MEMORY.md'), 'private');
  await writeFile(join(peer, 'artifact.txt'), 'shared artifact');
  request.readableDirs = [project, peer];
  request.writableDirs = [project];
  request.permissions = { ...request.permissions, skills: false, runCommands: false };
  const prepared = await sandbox(request);
  const signal = new AbortController().signal;
  await executeTool(request, 'write_file', { path: join(project, 'file.txt'), content: 'scoped' }, signal, prepared);
  expect(await readFile(join(project, 'file.txt'), 'utf8')).toBe('scoped');
  expect(await executeTool(request, 'read_file', { path: join(project, 'file.txt') }, signal, prepared)).toContain(
    'scoped',
  );
  expect(await executeTool(request, 'list_files', { path: project }, signal, prepared)).toContain('file.txt');
  expect(await executeTool(request, 'read_file', { path: join(peer, 'artifact.txt') }, signal, prepared)).toContain(
    'shared artifact',
  );
  await expect(executeTool(request, 'read_file', { path: join(peer, 'MEMORY.md') }, signal, prepared)).rejects.toThrow(
    'MEMORY',
  );
  await expect(executeTool(request, 'run_command', { command: '/bin/cat anything' }, signal, prepared)).rejects.toThrow(
    '許可',
  );
  request.permissions.runCommands = true;
  await expect(sandbox(request)).rejects.toThrow('両立');
});

it.skipIf(process.platform !== 'darwin')('指定フォルダ内の外向きリンクとhardlinkから実読み書きしない', async () => {
  const request = await fixture();
  const project = join(request.workspace, '../project');
  const outside = join(request.workspace, '../outside');
  await mkdir(project);
  await mkdir(outside);
  await writeFile(join(outside, 'secret'), 'keep outside');
  await symlink(outside, join(project, 'escape'));
  await link(join(outside, 'secret'), join(project, 'alias'));
  request.readableDirs = [project];
  request.writableDirs = [project];
  request.permissions = { ...request.permissions, skills: false, runCommands: false };
  const prepared = await sandbox(request);
  const signal = new AbortController().signal;
  for (const path of [join(project, 'escape/secret'), join(project, 'alias')]) {
    await expect(executeTool(request, 'read_file', { path }, signal, prepared)).rejects.toThrow();
    await expect(
      executeTool(request, 'write_file', { path, content: 'overwrite' }, signal, prepared),
    ).rejects.toThrow();
  }
  expect(await readFile(join(outside, 'secret'), 'utf8')).toBe('keep outside');
});
