import { afterEach, expect, it } from 'vitest';
import { mkdtemp, writeFile, link, symlink, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runRequest } from '../run.test-support.ts';
import { readLocal } from './read.ts';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'grok-read-'));
  roots.push(root);
  const workspace = join(root, 'work');
  const stateDir = join(root, 'state');
  await mkdir(workspace); await mkdir(stateDir);
  const request = { ...runRequest('grok'), workspace, stateDir, permissions: { ...runRequest('grok').permissions, readFiles: true, readAnywhere: true } };
  return { root, request, workspace, stateDir, signal: new AbortController().signal };
}
it('reads a single-link file but rejects a hardlink to a secret in the workspace', async () => {
  const f = await fixture();
  await writeFile(join(f.workspace, 'normal.txt'), 'normal');
  expect(await readLocal(f.request, 'normal.txt', f.signal)).toBe('normal');
  await writeFile(join(f.root, '.env'), 'synthetic-secret');
  await link(join(f.root, '.env'), join(f.workspace, 'alias.txt'));
  await expect(readLocal(f.request, 'alias.txt', f.signal)).rejects.toMatchObject({ code: 'unsupported_permission' });
});
it('rejects a junction into management and a direct secret filename', async () => {
  const f = await fixture();
  await writeFile(join(f.stateDir, 'private.txt'), 'synthetic-secret');
  await symlink(f.stateDir, join(f.workspace, 'alias'), 'junction');
  await expect(readLocal(f.request, 'alias/private.txt', f.signal)).rejects.toMatchObject({ code: 'unsupported_permission' });
  await writeFile(join(f.workspace, '.env'), 'synthetic-secret');
  await expect(readLocal(f.request, '.env', f.signal)).rejects.toMatchObject({ code: 'unsupported_permission' });
});
