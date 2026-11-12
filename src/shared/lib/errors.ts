import type { ErrorCode } from '@/shared/types/domain';
import { errorCodeEnum } from '@/shared/types/schemas/system';
import { t } from './i18n';

function hasMessage(value: unknown): value is { message: string } {
  return typeof value === 'object' && value !== null && 'message' in value && typeof value.message === 'string';
}

/**
 * 失敗を表示用の文字列にする。
 * コマンドの失敗（CommandError: { code, message }）・Error・文字列を受け付ける。
 */
export function errorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim() !== '') return error;
  if (hasMessage(error) && error.message.trim() !== '') return error.message;
  return t('unexpectedError');
}

/**
 * validation の失敗がどの入力のことか（CommandError.field。コマンドの入力の camelCase のキー）。
 * 入力に結びつかない失敗やコマンドの失敗でなければ null
 */
export function errorField(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('field' in error)) return null;
  return typeof error.field === 'string' && error.field !== '' ? error.field : null;
}

/** コマンドの失敗の code（code で分岐するときに使う）。コマンドの失敗でなければ null */
export function errorCode(error: unknown): ErrorCode | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const { code } = error;
  return errorCodeEnum(code, 'code').length === 0 ? (code as ErrorCode) : null;
}
