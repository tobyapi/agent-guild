import type { JsonObject } from '../line-parser.ts';
import type { DecodeResult } from '../request-decoder.ts';

export function decodeBackground(value: JsonObject, id: string | null): DecodeResult {
  if (id === null) return { ok: false, id, message: 'Background request requires an id' };
  if (value.type === 'backgroundCancel') return { ok: true, request: { type: 'backgroundCancel', id } };
  if (typeof value.backend !== 'string' || typeof value.prompt !== 'string' || value.prompt.length > 8000) {
    return { ok: false, id, message: 'Invalid background request' };
  }
  return { ok: true, request: { type: 'background', id, backend: value.backend, prompt: value.prompt } };
}
