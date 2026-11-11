import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { REAL_MACOS, runRequest } from '../run.test-support.ts';
import { runLocalCommand } from './command.ts';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
const child = () =>
  Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    stdin: Object.assign(new EventEmitter(), { end() {} }),
    pid: 12345,
  });
let root: string;
beforeEach(async () => {
  vi.clearAllMocks();
  root = await realpath(await mkdtemp(join(tmpdir(), 'ollama-command-')));
  await mkdir(join(root, 'work'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});
const request = () => ({
  ...runRequest('ollama'),
  options: { enableTools: true },
  workspace: join(root, 'work'),
  stateDir: join(root, 'state'),
});

// spawn はモックだが、隔離の用意（sandbox-exec があることの確認）は本物なので macOS だけで行う
describe.skipIf(!REAL_MACOS)('sandbox process', () => {
  it('秘密の環境変数を渡さず、終了コードと出力を返す', async () => {
    const proc = child();
    vi.stubEnv('EXAMPLE_API_KEY', 'private');
    vi.mocked(spawn).mockImplementation(() => {
      setTimeout(() => {
        proc.stdout.emit('data', Buffer.from('ok'));
        proc.emit('close', 3);
      }, 0);
      return proc as unknown as ReturnType<typeof spawn>;
    });
    const result = JSON.parse(await runLocalCommand(request(), 'echo ok', new AbortController().signal)) as object;
    expect(result).toMatchObject({ exitCode: 3, output: 'ok', stopped: false });
    const options = vi.mocked(spawn).mock.calls[0]?.[2];
    expect(options?.env).not.toHaveProperty('EXAMPLE_API_KEY');
    expect(options?.env).not.toHaveProperty('CODEX_HOME');
  });

  it('隔離機構が失敗しても通常のシェルで再試行しない', async () => {
    const proc = child();
    vi.mocked(spawn).mockImplementation(() => {
      setTimeout(() => {
        proc.stderr.emit('data', Buffer.from('sandbox failed'));
        proc.emit('close', 1);
      }, 0);
      return proc as unknown as ReturnType<typeof spawn>;
    });
    const result = await runLocalCommand(request(), 'echo ok', new AbortController().signal);
    expect(result).toContain('sandbox failed');
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(spawn).mock.calls[0]?.[0]).toBe('/usr/bin/sandbox-exec');
  });

  it.skipIf(process.platform === 'win32')('POSIXのキャンセルではプロセス群を止め、cancelledを返す', async () => {
    const proc = child();
    const controller = new AbortController();
    let closed = false;
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
      if (!closed) {
        closed = true;
        setTimeout(() => proc.emit('close', null), 0);
      }
      return true;
    });
    vi.mocked(spawn).mockImplementation(() => {
      setTimeout(() => controller.abort(), 0);
      return proc as unknown as ReturnType<typeof spawn>;
    });
    await expect(runLocalCommand(request(), 'sleep 60', controller.signal)).rejects.toHaveProperty('code', 'cancelled');
    expect(kill).toHaveBeenCalledWith(-12345, 'SIGKILL');
  });
});
