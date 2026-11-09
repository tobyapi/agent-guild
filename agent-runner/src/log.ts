// stderr 用のロガー。stdout はプロトコル専用なので、ログは必ずここを通して stderr に出す（Rust 側が log に流す）。

import { Console } from 'node:console';
import { inspect } from 'node:util';

/** 例外として投げられた値（Error とは限らない）を1行の説明にする */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : inspect(error);
}

export function logInfo(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function logError(message: string, error?: unknown): void {
  if (error === undefined) {
    process.stderr.write(`${message}\n`);
    return;
  }
  const detail = error instanceof Error ? (error.stack ?? error.message) : errorMessage(error);
  process.stderr.write(`${message}: ${detail}\n`);
}

/** console.log など stdout に書く console も stderr に向ける（SDK などが console に書いても stdout を汚さない） */
export function redirectConsoleToStderr(): void {
  globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
}
