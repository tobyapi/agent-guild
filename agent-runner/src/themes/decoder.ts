import type { JsonObject } from '../line-parser.ts';
import type { DecodeResult } from '../request-decoder.ts';
export function decodeTheme(value: JsonObject, id: string | null): DecodeResult {
  if (
    !id ||
    typeof value.backend !== 'string' ||
    typeof value.subject !== 'string' ||
    !value.subject.trim() ||
    Array.from(value.subject).length > 200
  )
    return { ok: false, id, message: 'Invalid theme request' };
  return { ok: true, request: { type: 'theme', id, backend: value.backend, subject: value.subject } };
}
