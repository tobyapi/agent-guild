import { t } from './texts.ts';
import { BackendError } from '../types.ts';

export type Item = Record<string, unknown>;
export const invalid = (): BackendError => new BackendError('invalid_response', t('invalid'));
export const truncated = (): BackendError => new BackendError('response_truncated', t('truncated'));
export const blocked = (): BackendError => new BackendError('response_blocked', t('blocked'));
export function object(value: unknown): value is Item {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function json(text: string): Item {
  try {
    const value: unknown = JSON.parse(text);
    if (object(value)) return value;
  } catch {
    /* Never include provider-controlled data in errors. */
  }
  throw invalid();
}
