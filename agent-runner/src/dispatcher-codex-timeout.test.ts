import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { codexAdapter } from './backends/codex.ts';
import { BackendRegistry } from './backends/registry.ts';
import { runRequest } from './backends/run.test-support.ts';
import { Dispatcher } from './dispatcher.ts';
import type { RunnerEvent } from './protocol.ts';

const startThread = vi.hoisted(() => vi.fn(() => ({ runStreamed: () => ({ events: [] }) })));
vi.mock('@openai/codex-sdk', () => ({
  Codex: class {
    startThread = startThread;
  },
}));
vi.mock('./backends/codex-runtime/executable.ts', () => ({
  findCodex: () => ({ path: 'codex', pathDirs: [] }),
  codexNotFound: () => 'missing',
}));
vi.mock('./backends/auth-mode.ts', async (original) => ({
  ...(await original<typeof import('./backends/auth-mode.ts')>()),
  codexAuthEnvironment: (env: unknown) => Promise.resolve(env),
}));
vi.mock('./backends/command-sandbox.ts', async (original) => ({
  ...(await original<typeof import('./backends/command-sandbox.ts')>()),
  prepareCommandSandbox: () => Promise.resolve(true),
}));
vi.mock('node:fs/promises', { spy: true });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it.each([
  ['timeout', false],
  ['cancelled', false],
  ['timeout', true],
  ['cancelled', true],
] as const)('Codex の %s で後処理中の作業場所を守る（猶予超過: %s）', async (code, exceedGrace) => {
  startThread.mockClear();
  const root = await mkdtemp(join(tmpdir(), 'guild-codex-timeout-'));
  const workspace = join(root, 'work');
  const stateDir = join(root, 'state', 'codex');
  const stateFile = join(stateDir, 'in-use');
  const skillPath = join(workspace, '.agents', 'skills', 'review', 'SKILL.md');
  const actualFs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  const writing = deferred<void>();
  const release = deferred<void>();
  let pendingWrite: Promise<void> | undefined;
  vi.mocked(writeFile).mockImplementationOnce((...args) => {
    pendingWrite = release.promise.then(() => actualFs.writeFile(...args));
    writing.resolve();
    return pendingWrite;
  });
  const first = deferred<RunnerEvent>();
  const next = deferred<RunnerEvent>();
  const events: RunnerEvent[] = [];
  const dispatcher = new Dispatcher({
    registry: new BackendRegistry([codexAdapter]),
    runnerVersion: 'test',
    send: (event) => {
      events.push(event);
      if (event.type === 'error' || event.type === 'result') {
        if (event.id === 'first') first.resolve(event);
        if (event.id === 'next') next.resolve(event);
      }
    },
    exit: vi.fn(),
  });
  const run = (id: string) =>
    dispatcher.receive({
      kind: 'message',
      value: {
        ...runRequest('codex'),
        id,
        workspace,
        stateDir,
        prepareWorkspace: true,
        timeoutMinutes: code === 'timeout' ? 30 : undefined,
        skills: [{ name: 'review', description: 'Review', body: id, dir: null, files: [] }],
      },
    });

  vi.useFakeTimers();
  try {
    run('first');
    await Promise.race([
      writing.promise,
      first.promise.then((event) => {
        throw new Error(`Unexpected terminal event: ${JSON.stringify(event)}`);
      }),
    ]);
    if (code === 'cancelled') dispatcher.cancel('first');
    await vi.advanceTimersByTimeAsync(code === 'timeout' ? 30 * 60_000 : 0);
    expect(events).toEqual([]);
    expect(startThread).not.toHaveBeenCalled();

    if (exceedGrace) {
      await actualFs.writeFile(stateFile, 'first');
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(first.promise).resolves.toMatchObject({ type: 'error', id: 'first', code });
      run('blocked');
      expect(events.at(-1)).toMatchObject({ type: 'error', id: 'blocked', code: 'bad_request' });
      expect(await readFile(stateFile, 'utf8')).toBe('first');
      await expect(readFile(skillPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
      expect(startThread).not.toHaveBeenCalled();
    }

    release.resolve();
    await pendingWrite;
    await expect(first.promise).resolves.toMatchObject({ type: 'error', id: 'first', code });
    await vi.advanceTimersByTimeAsync(0);
    expect(await readFile(skillPath, 'utf8')).toContain('first');
    expect(startThread).not.toHaveBeenCalled();

    run('next');
    await expect(next.promise).resolves.toMatchObject({ type: 'result', id: 'next' });
    expect(await readFile(skillPath, 'utf8')).toContain('next');
    await expect(readFile(stateFile, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    expect(startThread).toHaveBeenCalledOnce();
    expect(events.filter((event) => 'id' in event && event.id === 'first')).toHaveLength(1);
  } finally {
    release.resolve();
    await pendingWrite?.catch(() => undefined);
    vi.useRealTimers();
    await rm(root, { recursive: true, force: true });
  }
});
