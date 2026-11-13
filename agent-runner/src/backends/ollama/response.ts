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

export function replyMetrics(content: string, evalCount?: number) {
  let fieldLengths: Record<string, number> | undefined;
  try {
    const parsed: unknown = JSON.parse(content);
    if (isJsonObject(parsed)) {
      fieldLengths = {};
      for (const key of ['text', 'path', 'content', 'command', 'name']) {
        if (typeof parsed[key] === 'string') fieldLengths[key] = parsed[key].length;
      }
    }
  } catch {
    /* The reply remains measurable even when it is incomplete JSON. */
  }
  return {
    ...(evalCount === undefined ? {} : { eval_count: evalCount }),
    replyLength: content.length,
    replyTrimmedLength: content.replace(/\s/g, '').length,
    replyHead: content.slice(0, 200),
    ...(fieldLengths === undefined ? {} : { fieldLengths }),
  };
}
