// 役割の範囲でコマンドを動かす（共通の隔離の中）。どのバックエンドでも同じ範囲になるように、依頼（RunRequest）から決める:
// 書けるのは作業場所だけ（書き込みの権限がある役割）、読めるのは作業場所・相談元などの読み取りフォルダ・道具のフォルダだけ。
// 役割が PC 全体の読み取りを許していても、コマンドには広げない（秘密のファイル名の除外を、コマンドでは守れないため。
// 広く読むのは、秘密の場所を除けるファイル道具の役目）。通信はできない。

import { mkdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { commandSandboxReady, runInSandbox } from '../command-sandbox.ts';
import { BackendError, type RunRequest } from '../types.ts';

export interface RoleCommandOptions {
  signal: AbortSignal;
  /** 1回のコマンドの時間切れ */
  timeoutMs: number;
  /** 出力の上限バイト数（超えたら止める） */
  outputLimit: number;
  /** readableDirs のほかに読ませる場所（スキルの展開先など。なければ飛ばす） */
  extraReadable?: readonly string[];
}

/** 実在するものだけ、リンクを解決して返す */
async function existing(paths: readonly string[]): Promise<string[]> {
  const resolved = await Promise.all(paths.map((path) => realpath(path).catch(() => null)));
  return resolved.filter((path): path is string => path !== null);
}

/** command は Windows PowerShell の文。戻り値は `exit=<終了コード>\n<出力>`。隔離を使えない PC では実行しない */
export async function runRoleCommand(
  request: RunRequest,
  command: string,
  options: RoleCommandOptions,
): Promise<string> {
  if (!commandSandboxReady()) {
    throw new BackendError('unsupported_permission', 'この PC ではコマンドを隔離できないので、実行しません');
  }
  await mkdir(request.stateDir, { recursive: true });
  const [workspace, stateDir] = await Promise.all([realpath(request.workspace), realpath(request.stateDir)]);
  const readable = await existing([...request.readableDirs, ...(options.extraReadable ?? [])]);
  const canWrite = request.permissions.writeFiles;
  return runInSandbox(
    {
      cwd: workspace,
      // 書き込みの権限がない役割では、作業場所も読み取りだけ（MEMORY.md の例外はファイル道具だけのもの）
      writable: canWrite ? [workspace] : [],
      readable: canWrite ? readable : [workspace, ...readable],
      // 管理領域の中に、隔離の中専用のホームを置く（実行のたびに Rust が管理領域ごと作り直す）
      home: join(stateDir, 'command-home'),
    },
    command,
    { signal: options.signal, timeoutMs: options.timeoutMs, outputLimit: options.outputLimit, stateDir },
  );
}
