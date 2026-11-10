// 公式 Claude Code に認証を任せる。Windows では既存のコンソールを開き、macOS では CLI がブラウザーを開く。

import { execFile, spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import { BackendError, type LoginContext } from '../types.ts';
import { CLAUDE_NOT_FOUND, findClaude } from './executable.ts';

/** アプリからログインを始められるか */
export const CAN_LOGIN = process.platform === 'win32' || process.platform === 'darwin';
const exec = promisify(execFile);

/** Claude Code を起動するコマンド（npm の cli.js なら node で動かす） */
export function loginCommand(executable: string, node: string = process.execPath): [string, ...string[]] {
  return executable.endsWith('.js') ? [node, executable] : [executable];
}

function auth(executable: string, action: 'login' | 'status', timeout: number, signal?: AbortSignal) {
  const [file, ...args] = loginCommand(executable);
  return exec(file, [...args, 'auth', action], { cwd: homedir(), timeout, signal });
}

/** macOS のキーチェーンも含め、認証状態は CLI の終了コードで確認する。 */
export async function claudeLoginStatus(executable: string): Promise<boolean | null> {
  try {
    await auth(executable, 'status', 5000);
    return true;
  } catch (error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 1 ? false : null;
  }
}

/** cmd.exe に渡す引数。start /wait で新しい窓に command の auth login を開き、閉じるまで待つ。/s で外側の引用符を外す */
export function loginArguments(command: readonly string[]): string {
  const quoted = command.map((part) => `"${part}"`).join(' ');
  return `/d /s /c "start "Claude にログイン" /wait ${quoted} auth login"`;
}

/**
 * ログインの窓を開き、閉じるまで待つ。start /wait は claude の終了コードを返さないので、成否はここでは決めない
 * （呼び出し側が窓が閉じたあとの状態を確かめる）。Claude Code がなければ開かない（start に渡すとエラーのダイアログで止まる）
 */
export function openLoginWindow({ signal }: LoginContext): Promise<void> {
  const executable = findClaude();
  if (executable === null) return Promise.reject(new BackendError('internal', CLAUDE_NOT_FOUND));
  if (process.platform === 'darwin') {
    return auth(executable, 'login', 300_000, signal).then(
      () => undefined,
      () => {
        // CLI の出力には認証用の URL が含まれるため、表示やログには渡さない。
        throw new BackendError(
          'auth',
          'Claude にログインできませんでした。ブラウザーを確認して、もう一度お試しください。',
        );
      },
    );
  }
  return new Promise((resolve, reject) => {
    // cmd 自身の窓は出さない（start が claude の窓を新しく開く）
    const child = spawn('cmd.exe', [loginArguments(loginCommand(executable))], {
      cwd: homedir(),
      stdio: 'ignore',
      windowsHide: true,
      windowsVerbatimArguments: true,
    });
    const close = (): void => {
      // start で開いた claude の窓ごと閉じる
      if (child.pid !== undefined)
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    };
    signal.addEventListener('abort', close, { once: true });
    child.once('error', (error) => {
      signal.removeEventListener('abort', close);
      reject(new BackendError('internal', `ログインの窓を開けませんでした（${error.message}）`));
    });
    child.once('exit', () => {
      signal.removeEventListener('abort', close);
      resolve();
    });
  });
}
