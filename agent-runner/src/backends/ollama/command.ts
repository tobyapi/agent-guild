// ローカルモデル用。推論・認証を使わず Codex CLI の OS sandbox だけでコマンドを実行する。
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { withoutSecrets } from '../agent-env.ts';
import { CODEX_NOT_FOUND, findCodex } from '../codex-runtime/executable.ts';
import { BackendError, type RunRequest } from '../types.ts';

export function commandArguments(request: RunRequest, command: string): string[] {
  const { writeFiles, writeAnywhere, webFetch } = request.permissions;
  const mode = writeFiles ? (writeAnywhere ? 'danger-full-access' : 'workspace-write') : 'read-only';
  const config = {
    sandbox_mode: mode,
    'sandbox_workspace_write.writable_roots': [],
    'sandbox_workspace_write.exclude_tmpdir_env_var': true,
    'sandbox_workspace_write.exclude_slash_tmp': true,
    'sandbox_workspace_write.network_access': webFetch,
    'sandbox_read_only.network_access': webFetch,
  };
  const shell =
    process.platform === 'win32'
      ? ['powershell.exe', '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command]
      : ['/bin/sh', '-c', command];
  return [
    'sandbox',
    ...Object.entries(config).flatMap(([key, value]) => ['-c', `${key}=${JSON.stringify(value)}`]),
    '--',
    ...shell,
  ];
}

function execute(
  file: string,
  args: string[],
  request: RunRequest,
  home: string,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const child = spawn(file, args, {
      cwd: request.workspace,
      env: { ...withoutSecrets(process.env, () => false), CODEX_HOME: home },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: process.platform !== 'win32',
    });
    let output = '';
    let stopped = false;
    const stop = () => {
      stopped = true;
      if (process.platform === 'win32') {
        if (child.pid)
          spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
      } else if (child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* 終了済み */
        }
      }
    };
    const timer = setTimeout(stop, 60_000);
    signal.addEventListener('abort', stop, { once: true });
    const collect = (data: Buffer) => {
      output += data.toString();
      if (output.length > 32_000) {
        output = output.slice(0, 32_000);
        stop();
      }
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', reject);
    child.once('close', (code) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
      if (signal.aborted) reject(new DOMException('実行を中断しました', 'AbortError'));
      else resolve(JSON.stringify({ exitCode: code, stopped, output }));
    });
  });
}

export async function runLocalCommand(request: RunRequest, command: string, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  if (!request.permissions.runCommands)
    throw new BackendError('unsupported_permission', 'コマンド実行は許可されていません');
  if (request.permissions.writeAnywhere && (!request.permissions.writeFiles || !request.permissions.webFetch))
    throw new BackendError('unsupported_permission', '範囲外への書き込みにはwriteFilesとwebFetchが必要です');
  const executable = findCodex();
  if (!executable) throw new BackendError('unsupported_permission', CODEX_NOT_FOUND);
  await mkdir(request.stateDir, { recursive: true });
  const home = await mkdtemp(join(request.stateDir, 'local-command-'));
  try {
    return await execute(executable.path, commandArguments(request, command), request, home, signal);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}
