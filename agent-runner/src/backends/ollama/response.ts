import { isJsonObject, type JsonObject } from '../../line-parser.ts';
import { BackendError } from '../types.ts';
import { t } from './texts/index.ts';

function evalCount(value: unknown): string {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : 'unknown';
}

export function throwIfTruncated(response: JsonObject): void {
  if (response.done_reason !== 'length') return;
  const content =
    isJsonObject(response.message) && typeof response.message.content === 'string' ? response.message.content : '';
  throw new BackendError(
    'internal',
    t('outputTruncated', {
      head: content.slice(0, 500),
      tail: content.slice(-500),
      count: evalCount(response.eval_count),
    }),
  );
}
