// Claude のログイン: 利用者の環境の Claude Code（executable.ts）の `auth login` を新しいコンソールウィンドウで開き、
// 利用者がブラウザでログインを終えて窓が閉じるまで待つ。
// 別ウィンドウの開き方（cmd の start /wait）が Windows 向けなので、いまは Windows だけで使える。

import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { BackendError, type LoginContext } from '../types.ts';
import { CLAUDE_NOT_FOUND, findClaude } from './executable.ts';

/** アプリからログインを始められるか */
export const CAN_LOGIN = process.platform === 'win32';

/** Claude Code を起動するコマンド（npm の cli.js なら node で動かす） */
export function loginCommand(executable: string, node: string = process.execPath): string[] {
  return executable.endsWith('.js') ? [node, executable] : [executable];
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
      if (child.pid !== undefined) spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
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
