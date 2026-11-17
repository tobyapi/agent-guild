import { t } from './texts.ts';
import { BackendError } from '../types.ts';
import { sse } from './sse.ts';
import { invalid, json, type Item } from './json.ts';

async function checked(response: Response): Promise<ReadableStream<Uint8Array>> {
  if (!response.ok) {
    await response.body?.cancel();
    const code =
      response.status === 401 || response.status === 403
        ? 'auth'
        : response.status === 429
          ? 'rate_limit'
          : response.status === 404
            ? 'model_not_found'
            : 'internal';
    throw new BackendError(code, t('http', { status: response.status }));
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    await response.body?.cancel();
    throw invalid();
  }
  return response.body;
}

/** Endpoints are supplied by built-in codecs only. No redirects, retries or raw provider errors. */
export async function* stream(url: string, keyHeader: Record<string, string>, body: Item, signal: AbortSignal) {
  signal.throwIfAborted();
  const payload = JSON.stringify(body);
  if (Buffer.byteLength(payload) > 2 * 1024 * 1024)
    throw new BackendError('bad_request', 'API request size limit exceeded.');
  try {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...keyHeader },
      body: payload,
    });
    for await (const event of sse(await checked(response), signal)) {
      if (event === '[DONE]') {
        yield null;
        return;
      }
      const value = json(event);
      if (value.error) throw invalid();
      yield value;
    }
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof BackendError) throw error;
    throw new BackendError('internal', t('transport'));
  }
}
