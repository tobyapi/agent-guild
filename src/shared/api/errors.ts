// コマンドの失敗（CommandError { code, message, field }）の扱い。
import { errorCode, errorField, errorMessage } from '@/shared/lib/errors';
import type { CommandError, ErrorCode } from '@/shared/types/domain';

/**
 * コマンドの失敗。Tauri が reject した CommandError を Error に包んだもの（code で分岐できる）。
 * 判定は shared/lib/errors の errorCode / errorMessage で行う（この型を import しなくてよい）。
 */
export class ApiError extends Error implements CommandError {
  readonly code: ErrorCode;
  readonly field: string | null;

  constructor(error: CommandError, options?: ErrorOptions) {
    super(error.message, options);
    this.name = 'ApiError';
    this.code = error.code;
    this.field = error.field;
  }
}

/** reject された値を CommandError にそろえる。契約外の値は internal として扱う */
export function toCommandError(reason: unknown): CommandError {
  return { code: errorCode(reason) ?? 'internal', message: errorMessage(reason), field: errorField(reason) };
}
