// Claude のログイン: SDK が同梱している Claude Code（OS ごとのパッケージの claude.exe）の `auth login` を
// 新しいコンソールウィンドウで開き、利用者がブラウザでログインを終えて窓が閉じるまで待つ。
// 別ウィンドウの開き方（cmd の start /wait）が Windows 向けなので、いまは Windows だけで使える。

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { errorMessage } from '../../log.ts';
import { BackendError, type LoginContext } from '../types.ts';

/** アプリからログインを始められるか */
export const CAN_LOGIN = process.platform === 'win32';

/** SDK が使う Claude Code の実行ファイル（@anthropic-ai/claude-agent-sdk-<OS>-<CPU> に同梱）。見つからなければ例外 */
export function bundledClaudePath(platform: string = process.platform, arch: string = process.arch): string {
  const require = createRequire(import.meta.url);
  const manifest = require.resolve(`@anthropic-ai/claude-agent-sdk-${platform}-${arch}/package.json`);
  return join(dirname(manifest), platform === 'win32' ? 'claude.exe' : 'claude');
}

/** cmd.exe に渡す引数。start /wait で新しい窓を開き、閉じるまで待つ。/s で外側の引用符を外す */
export function loginArguments(claudePath: string): string {
  return `/d /s /c "start "Claude にログイン" /wait "${claudePath}" auth login"`;
}

/**
 * ログインの窓を開き、閉じるまで待つ。start /wait は claude の終了コードを返さないので、成否はここでは決めない
 * （呼び出し側が窓が閉じたあとの状態を確かめる）
 */
export function openLoginWindow({ signal }: LoginContext): Promise<void> {
  let claudePath: string;
  try {
    claudePath = bundledClaudePath();
    // 無いまま start に渡すと、Windows のエラーのダイアログが出て止まる
    if (!existsSync(claudePath)) throw new Error(`${claudePath} がありません`);
  } catch (error) {
    return Promise.reject(new BackendError('internal', `Claude Code の実行ファイルが見つかりません（${errorMessage(error)}）`));
  }
  return new Promise((resolve, reject) => {
    // cmd 自身の窓は出さない（start が claude の窓を新しく開く）
    const child = spawn('cmd.exe', [loginArguments(claudePath)], {
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
