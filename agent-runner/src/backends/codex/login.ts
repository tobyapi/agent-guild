// Codex CLI がブラウザーで ChatGPT の認証を行い、資格情報を保存するまで待つ。
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import { CODEX_NOT_FOUND, findCodex, type CodexExecutable } from '../codex-runtime/executable.ts';
import { withPathDirs } from '../executables.ts';
import { BackendError, type LoginContext } from '../types.ts';

export const CAN_LOGIN = process.platform === 'darwin';
const exec = promisify(execFile);

function loginCommand(executable: CodexExecutable, args: string[], timeout: number, signal?: AbortSignal) {
  return exec(executable.path, ['login', ...args], {
    cwd: homedir(),
    env: withPathDirs(executable.pathDirs),
    timeout,
    signal,
  });
}

export async function hasCodexLogin(executable: CodexExecutable): Promise<boolean> {
  try {
    await loginCommand(executable, ['status'], 5000);
    return true;
  } catch {
    return false;
  }
}

export async function loginCodex({ signal }: LoginContext): Promise<void> {
  const executable = findCodex();
  if (executable === null) throw new BackendError('internal', CODEX_NOT_FOUND);
  try {
    await loginCommand(executable, [], 300_000, signal);
  } catch {
    // 子プロセスの出力には認証用の URL が含まれるため、表示やログには渡さない。
    throw new BackendError(
      'auth',
      'ChatGPT にログインできませんでした。ブラウザーを確認して、もう一度お試しください。',
    );
  }
}
