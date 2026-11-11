import { spawn } from 'node:child_process';
import { BackendError } from '../types.ts';
import { OUTPUT_LIMIT } from './limits.ts';
const SANDBOX = '/usr/bin/sandbox-exec';
export function sandboxProcess(
  profile: string,
  workspace: string,
  executable: string,
  args: string[],
  signal: AbortSignal,
  input = '',
): Promise<string> {
  signal.throwIfAborted();
  return new Promise((resolveResult, reject) => {
    const child = spawn(SANDBOX, ['-p', profile, executable, ...args], {
      cwd: workspace,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      // 親のトークン・プロキシ・シェル起動設定を渡さない。
      env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: workspace, TMPDIR: workspace, LANG: 'en_US.UTF-8' },
    });
    let output = Buffer.alloc(0);
    let failure: Error | undefined;
    const kill = () => {
      if (child.pid) {
        try {
          process.kill(child.pid, 'SIGKILL');
        } catch {
          /* already exited */
        }
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* already exited */
        }
      }
    };
    const abort = () => {
      failure = new BackendError('cancelled', '中断しました');
      kill();
    };
    const timer = setTimeout(() => {
      failure = new BackendError('internal', '道具の実行が30秒を超えました');
      kill();
    }, 30_000);
    signal.addEventListener('abort', abort, { once: true });
    const collect = (data: Buffer) => {
      if (output.length + data.length > OUTPUT_LIMIT) {
        failure = new BackendError('internal', '道具の出力が32KiBを超えました');
        kill();
      } else output = Buffer.concat([output, data]);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.stdin.on('error', () => {
      /* 子プロセスの失敗は close で報告 */
    });
    child.on('error', (error) => {
      failure = error;
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      kill();
      if (failure) reject(failure);
      else resolveResult(`exit=${code}\n${output.toString('utf8')}`);
    });
    child.stdin.end(input);
    if (signal.aborted) abort();
  });
}
