import { mkdtemp, mkdir, writeFile, link, symlink, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { runRequest } from './run.test-support.ts';
import {
  assertFolderScope,
  assertSandboxedFolderScope,
  folderFileHook,
  folderFileResult,
  scopedTarget,
} from './folder-scope.ts';

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

it('permits project writes and peer artifacts, rejects outside and peer memory', async () => {
  const { request, shared, peer, outside } = await fixture();
  expect(
    (await folderFileResult(request, 'Write', { file_path: join(shared, 'new.txt'), content: 'ok' }))?.behavior,
  ).toBe('allow');
  expect((await folderFileResult(request, 'Read', { file_path: join(peer, 'artifact.txt') }))?.behavior).toBe('allow');
  expect((await folderFileResult(request, 'Read', { file_path: join(peer, 'MEMORY.md') }))?.behavior).toBe('deny');
  expect(
    (await folderFileResult(request, 'Write', { file_path: join(peer, 'new.txt'), content: 'no' }))?.behavior,
  ).toBe('deny');
  await expect(scopedTarget(request, join(outside, 'outside.txt'), false)).rejects.toThrow('範囲外');
});

it('rejects external symlinks, hardlinks and absolute/traversing glob patterns', async () => {
  const { request, shared, outside } = await fixture();
  await symlink(outside, join(shared, 'escape'));
  await link(join(outside, 'outside.txt'), join(shared, 'hardlink'));
  for (const path of ['escape/outside.txt', 'hardlink'])
    expect((await folderFileResult(request, 'Read', { file_path: join(shared, path) }))?.behavior).toBe('deny');
  for (const pattern of [join(outside, '*'), '../outside/*', '{../outside,src}/*'])
    expect((await folderFileResult(request, 'Glob', { path: shared, pattern }))?.behavior).toBe('deny');
  expect((await folderFileResult(request, 'Grep', { path: shared, pattern: 'outside' }))?.behavior).toBe('deny');
});

it('checks SDK auto-approved calls and rejects incompatible backends/permissions', async () => {
  const { request, outside } = await fixture();
  const hook = folderFileHook(request);
  const result = await hook(
    {
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: join(outside, 'outside.txt') },
    } as never,
    undefined,
    { signal: new AbortController().signal },
  );
  expect(result).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
  expect(() => assertFolderScope({ ...request, backend: 'claude' })).toThrow('リンク差し替え');
  expect(() => assertFolderScope({ ...request, backend: 'codex' })).toThrow('未対応');
  expect(() => assertFolderScope({ ...request, permissions: { ...request.permissions, writeAnywhere: true } })).toThrow(
    '両立',
  );
});

it('keeps the own-memory exception and denies permissions removed from roles', async () => {
  const { request, shared } = await fixture();
  request.permissions.readFiles = false;
  request.permissions.writeFiles = false;
  expect((await folderFileResult(request, 'Write', { file_path: 'MEMORY.md', content: 'memo' }))?.behavior).toBe(
    'allow',
  );
  expect((await folderFileResult(request, 'Write', { file_path: join(shared, 'file'), content: 'no' }))?.behavior).toBe(
    'deny',
  );
});

it('lets sandboxed backends keep commands, but not machine-wide access or relative paths', async () => {
  const { request } = await fixture();
  const codex = { ...request, backend: 'codex', permissions: { ...request.permissions, runCommands: true } };
  expect(() => assertSandboxedFolderScope(codex)).not.toThrow();
  expect(() => assertSandboxedFolderScope({ ...codex, writableDirs: undefined, workspace: 'relative' })).not.toThrow();
  for (const key of ['readAnywhere', 'writeAnywhere'] as const)
    expect(() => assertSandboxedFolderScope({ ...codex, permissions: { ...codex.permissions, [key]: true } })).toThrow(
      '両立',
    );
  expect(() => assertSandboxedFolderScope({ ...codex, writableDirs: ['project'] })).toThrow('絶対パス');
});
