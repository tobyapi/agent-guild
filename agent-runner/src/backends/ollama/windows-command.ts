// Windows でのコマンドの実行: 共通の隔離（../command-sandbox.ts。MXC）の中で Windows PowerShell を動かす。
// 見えるのは作業場所・相談元などの読み取りフォルダ・道具のフォルダだけで、通信はできない。
// 書き込みの権限がない役割では、作業場所も読み取りだけにする（MEMORY.md の例外はファイル道具だけのもの）。

import { mkdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { commandSandboxReady, runInSandbox } from '../command-sandbox.ts';
import { BackendError, type RunRequest } from '../types.ts';
import { OUTPUT_LIMIT } from './limits.ts';

/** 1回のコマンドの時間切れ（macOS の Seatbelt 版と同じ） */
const COMMAND_TIMEOUT_MS = 30_000;

/** 実在するものだけ、リンクを解決して返す */
async function existing(paths: readonly string[]): Promise<string[]> {
  const resolved = await Promise.all(paths.map((path) => realpath(path).catch(() => null)));
  return resolved.filter((path): path is string => path !== null);
}

/** workspace はリンクを解決済みの作業場所。戻り値は `exit=<終了コード>\n<出力>`（Seatbelt 版と同じ形） */
export async function windowsCommand(
  request: RunRequest,
  workspace: string,
  command: string,
  signal: AbortSignal,
): Promise<string> {
  if (!commandSandboxReady()) {
    throw new BackendError('unsupported_permission', 'この PC ではコマンドを隔離できないので、実行しません');
  }
  await mkdir(request.stateDir, { recursive: true });
  const stateDir = await realpath(request.stateDir);
  const readable = await existing(request.readableDirs);
  const canWrite = request.permissions.writeFiles;
  return runInSandbox(
    {
      cwd: workspace,
      writable: canWrite ? [workspace] : [],
      readable: canWrite ? readable : [workspace, ...readable],
      // 管理領域の中に、隔離の中専用のホームを置く（実行のたびに Rust が管理領域ごと作り直す）
      home: join(stateDir, 'command-home'),
    },
    command,
    { signal, timeoutMs: COMMAND_TIMEOUT_MS, outputLimit: OUTPUT_LIMIT, stateDir },
  );
}
