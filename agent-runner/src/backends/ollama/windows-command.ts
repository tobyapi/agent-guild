// Windows でのコマンドの実行: 共通の隔離（MXC）の中で、役割の範囲に閉じ込めて Windows PowerShell を動かす
// （範囲の決め方は ../command-sandbox/role-command.ts。Claude と同じ）。

import { runRoleCommand } from '../command-sandbox/role-command.ts';
import type { RunRequest } from '../types.ts';
import { OUTPUT_LIMIT } from './limits.ts';

/** 1回のコマンドの時間切れ（macOS の Seatbelt 版と同じ） */
const COMMAND_TIMEOUT_MS = 30_000;

/** 戻り値は `exit=<終了コード>\n<出力>`（Seatbelt 版と同じ形） */
export function windowsCommand(request: RunRequest, command: string, signal: AbortSignal): Promise<string> {
  return runRoleCommand(request, command, { signal, timeoutMs: COMMAND_TIMEOUT_MS, outputLimit: OUTPUT_LIMIT });
}
