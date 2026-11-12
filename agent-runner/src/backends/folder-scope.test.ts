import { mkdtemp, mkdir, writeFile, link, symlink, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { runRequest } from './run.test-support.ts';
import {
  assertBackendFolderScope,
  assertFolderScope,
  assertSandboxedFolderScope,
  scopedTarget,
} from './folder-scope.ts';
import type { BackendDescriptor } from './types.ts';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'channel-scope-')));
  roots.push(root);
  const workspace = join(root, 'work');
  const shared = join(root, 'project');
  const peer = join(root, 'peer');
  const outside = join(root, 'outside');
  for (const dir of [workspace, shared, peer, outside]) await mkdir(dir);
  await writeFile(join(shared, 'inside.txt'), 'inside');
  await writeFile(join(outside, 'outside.txt'), 'outside');
  await writeFile(join(peer, 'artifact.txt'), 'artifact');
  await writeFile(join(peer, 'MEMORY.md'), 'private');
  const request = { ...runRequest('ollama'), workspace, readableDirs: [shared, peer], writableDirs: [shared] };
  request.permissions = {
    ...request.permissions,
    skills: false,
    runCommands: false,
    readAnywhere: false,
    writeAnywhere: false,
  };
  return { request, shared, peer, outside };
}

it('指定先への書き込みと相談相手の成果物の読み取りを通し、範囲の外と相談相手のメモは断る', async () => {
  const { request, shared, peer, outside } = await fixture();
  expect(await scopedTarget(request, join(shared, 'new.txt'), true)).toBe(join(shared, 'new.txt'));
  expect(await scopedTarget(request, join(peer, 'artifact.txt'), false)).toBe(join(peer, 'artifact.txt'));
  expect(await scopedTarget(request, 'notes.md', true)).toBe(join(request.workspace, 'notes.md'));
  await expect(scopedTarget(request, join(peer, 'MEMORY.md'), false)).rejects.toThrow('共有されません');
  await expect(scopedTarget(request, join(peer, 'new.txt'), true)).rejects.toThrow('範囲外');
  await expect(scopedTarget(request, join(outside, 'outside.txt'), false)).rejects.toThrow('範囲外');
  await expect(scopedTarget(request, '../outside/outside.txt', false)).rejects.toThrow('範囲外');
});

it('範囲の外へ出るリンクと、ハードリンクを断る', async () => {
  const { request, shared, outside } = await fixture();
  await symlink(outside, join(shared, 'escape'));
  await link(join(outside, 'outside.txt'), join(shared, 'hardlink'));
  await expect(scopedTarget(request, join(shared, 'escape/outside.txt'), false)).rejects.toThrow('範囲外');
  await expect(scopedTarget(request, join(shared, 'hardlink'), false)).rejects.toThrow('ハードリンク');
  await expect(scopedTarget(request, join(shared, 'hardlink'), true)).rejects.toThrow('ハードリンク');
});

it('ファイルの道具で守るバックエンドは、コマンド・スキル・PC 全体の読み書きと両立しない', async () => {
  const { request } = await fixture();
  expect(() => assertFolderScope(request)).not.toThrow();
  for (const key of ['readAnywhere', 'writeAnywhere', 'skills', 'runCommands'] as const)
    expect(() => assertFolderScope({ ...request, permissions: { ...request.permissions, [key]: true } })).toThrow(
      '両立',
    );
  expect(() => assertFolderScope({ ...request, writableDirs: ['project'] })).toThrow('絶対パス');
  expect(() => assertFolderScope({ ...request, writableDirs: undefined, workspace: 'relative' })).not.toThrow();
});

it('隔離で守るバックエンドは、コマンドは使えるが、PC 全体の読み書きと相対パスは断る', async () => {
  const { request } = await fixture();
  const sandboxed = { ...request, permissions: { ...request.permissions, runCommands: true } };
  expect(() => assertSandboxedFolderScope(sandboxed)).not.toThrow();
  expect(() =>
    assertSandboxedFolderScope({ ...sandboxed, writableDirs: undefined, workspace: 'relative' }),
  ).not.toThrow();
  for (const key of ['readAnywhere', 'writeAnywhere'] as const)
    expect(() =>
      assertSandboxedFolderScope({ ...sandboxed, permissions: { ...sandboxed.permissions, [key]: true } }),
    ).toThrow('両立');
  expect(() => assertSandboxedFolderScope({ ...sandboxed, writableDirs: ['project'] })).toThrow('絶対パス');
});

it('守り方は、ID ではなくバックエンドの申告で決まる', async () => {
  const { request } = await fixture();
  const commands = { ...request, permissions: { ...request.permissions, runCommands: true } };
  const info = (folderScope: BackendDescriptor['folderScope']) => ({ label: 'Fake', folderScope }) as BackendDescriptor;
  expect(() => assertBackendFolderScope(info('files'), request)).not.toThrow();
  expect(() => assertBackendFolderScope(info('files'), commands)).toThrow('両立');
  expect(() => assertBackendFolderScope(info('sandbox'), commands)).not.toThrow();
  expect(() => assertBackendFolderScope(info(null), request)).toThrow('Fake は範囲を守れないため');
  expect(() => assertBackendFolderScope(info(null), { ...request, writableDirs: undefined })).not.toThrow();
});
