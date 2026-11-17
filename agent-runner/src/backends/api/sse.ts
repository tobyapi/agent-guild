import { invalid } from './json.ts';
import { BackendError } from '../types.ts';

const STREAM_LIMIT = 4 * 1024 * 1024;
const EVENT_LIMIT = 1024 * 1024;

/** SSE framing only; provider adapters must validate JSON and require their own terminal event. */
class Frames {
  #line = '';
  #data: string[] = [];
  #size = 0;
  #afterCR = false;

  push(text: string): string[] {
    const events: string[] = [];
    for (const char of text) {
      if (char === '\n' && this.#afterCR) {
        this.#afterCR = false;
        continue;
      }
      this.#afterCR = char === '\r';
      if (char === '\r' || char === '\n') {
        const event = this.#endLine();
        if (event !== undefined) events.push(event);
      } else {
        this.#line += char;
        if (++this.#size > EVENT_LIMIT) throw invalid();
      }
    }
    return events;
  }

  #endLine(): string | undefined {
    const line = this.#line;
    this.#line = '';
    if (line !== '') {
      if (line === 'data' || line.startsWith('data:')) this.#data.push(line.slice(5).replace(/^ /, ''));
      return;
    }
    const event = this.#data.length ? this.#data.join('\n') : undefined;
    this.#data = [];
    this.#size = 0;
    return event;
  }

  finish(): void {
    if (this.#data.length || this.#line === 'data' || this.#line.startsWith('data:')) throw invalid();
  }
}

export async function* sse(body: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const frames = new Frames();
  const abort = () => void reader.cancel().catch(() => {});
  signal.addEventListener('abort', abort, { once: true });
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > STREAM_LIMIT) throw invalid();
      for (const event of frames.push(decoder.decode(value, { stream: true }))) yield event;
    }
    for (const event of frames.push(decoder.decode())) yield event;
    // A dangling data frame means the response was cut, even after a provider finish reason.
    frames.finish();
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof BackendError) throw error;
    throw invalid();
  } finally {
    signal.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
