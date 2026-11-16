import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, realpath, mkdir, writeFile, rename, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runRequest } from '../run.test-support.ts';
import { readLocal } from './read.ts';
import { execute } from './tools.ts';
import { runContext } from '../run.test-support.ts';

vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>();
  return { ...fs, open: vi.fn(fs.open), realpath: vi.fn(fs.realpath) };
});
const roots: string[] = [];
afterEach(async () => {
  vi.mocked(open).mockReset();
  const fs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  vi.mocked(open).mockImplementation(fs.open);
  vi.mocked(realpath).mockReset();
  vi.mocked(realpath).mockImplementation(fs.realpath);
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'grok-read-race-')));
  roots.push(root);
  const workspace = join(root, 'work');
  const stateDir = join(root, 'state');
  await mkdir(workspace);
  await mkdir(stateDir);
  const target = join(workspace, 'public.txt');
  const replacement = join(stateDir, 'private.txt');
  await writeFile(target, 'approved-public');
  await writeFile(replacement, 'synthetic-private');
  const swap = async () => {
    await rename(target, join(workspace, 'old.txt'));
    await rename(replacement, target);
  };
  return {
    target,
    swap,
    request: { ...runRequest('grok'), workspace, stateDir },
    fs: await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises'),
  };
}

it('rejects a real file identity swap between approval and open before reading bytes', async () => {
  const f = await fixture();
  const observed = vi.fn();
  vi.mocked(open).mockImplementationOnce(async (path, flags) => {
    await f.swap();
    const handle = await f.fs.open(path, flags);
    vi.spyOn(handle, 'read').mockImplementation(observed);
    return handle;
  });
  await expect(readLocal(f.request, 'public.txt', new AbortController().signal)).rejects.toMatchObject({
    code: 'unsupported_permission',
  });
  expect(observed).not.toHaveBeenCalled();
  expect(open).toHaveBeenCalledOnce();
});

it('rejects a real identity swap after open and before post-open path checks', async () => {
  const f = await fixture();
  const observed = vi.fn();
  vi.mocked(open).mockImplementationOnce(async (path, flags) => {
    const handle = await f.fs.open(path, flags);
    await f.swap();
    vi.spyOn(handle, 'read').mockImplementation(observed);
    return handle;
  });
  await expect(readLocal(f.request, 'public.txt', new AbortController().signal)).rejects.toMatchObject({
    code: 'unsupported_permission',
  });
  expect(observed).not.toHaveBeenCalled();
  expect(open).toHaveBeenCalledOnce();
});

it('rejects a noncanonical path before opening even with readAnywhere permission', async () => {
  const f = await fixture();
  vi.mocked(realpath).mockImplementation(async (path) =>
    path === f.target ? join(f.request.workspace, 'canonical-name.txt') : f.fs.realpath(path),
  );
  await expect(readLocal(f.request, 'public.txt', new AbortController().signal)).rejects.toMatchObject({
    code: 'unsupported_permission',
  });
  expect(open).not.toHaveBeenCalled();
});

it('reads only the retained approved handle when the path is swapped during read', async () => {
  const f = await fixture();
  vi.mocked(open).mockImplementationOnce(async (path, flags) => {
    const handle = await f.fs.open(path, flags);
    const read = handle.read.bind(handle);
    vi.spyOn(handle, 'read').mockImplementationOnce(async (...args) => {
      await f.swap();
      return read(...args);
    });
    return handle;
  });
  expect(await readLocal(f.request, 'public.txt', new AbortController().signal)).toBe('approved-public');
});

it.each(['read_file', 'read_skill'])(
  'discards completed %s bytes when cancelled during the handle read',
  async (name) => {
    const f = await fixture();
    const abort = new AbortController();
    vi.mocked(open).mockImplementationOnce(async (path, flags) => {
      const handle = await f.fs.open(path, flags);
      const read = handle.read.bind(handle);
      vi.spyOn(handle, 'read').mockImplementationOnce(async (...args) => {
        const result = await read(...args);
        abort.abort();
        return result;
      });
      return handle;
    });
    f.request.skills = [{ name: 'fixture', description: '', body: '', dir: f.request.workspace, files: [] }];
    const args = name === 'read_file' ? { path: 'public.txt' } : { name: 'fixture', path: 'public.txt' };
    await expect(execute(f.request, runContext(abort.signal), name, JSON.stringify(args))).rejects.toThrow();
    expect(open).toHaveBeenCalledOnce();
    expect(abort.signal.aborted).toBe(true);
  },
);
