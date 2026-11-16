import { BackendError } from '../types.ts';
import { invalid, response, type Item, type Response } from './response.ts';

const LIMIT = 4 * 1024 * 1024;
export type Send = (body: Item, signal: AbortSignal) => Promise<Response>;

/** Only this closure receives the credential; no provider body or headers escape it. */
export function client(key: string): Send {
  return async (body, signal) => {
    try {
      const result = await fetch('https://api.x.ai/v1/responses', {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, store: false, stream: false }),
      });
      if (!result.ok) {
        await result.body?.cancel();
        const code =
          result.status === 429
            ? 'rate_limit'
            : [401, 403].includes(result.status)
              ? 'auth'
              : result.status === 404
                ? 'model_not_found'
                : 'internal';
        throw new BackendError(code, 'Grok API request failed.');
      }
      if (!result.body) throw invalid();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for await (const raw of result.body) {
        const chunk: unknown = raw;
        if (!(chunk instanceof Uint8Array)) throw invalid();
        size += chunk.byteLength;
        if (size > LIMIT) throw invalid();
        chunks.push(chunk);
      }
      return response(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof BackendError) throw error;
      throw new BackendError('internal', 'Grok API transport or response failed.');
    }
  };
}
