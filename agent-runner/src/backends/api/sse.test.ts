import { expect, it, vi } from 'vitest';
import { sse } from './sse.ts';

const signal = () => new AbortController().signal;
function bytes(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}
async function collect(body: ReadableStream<Uint8Array>, abort = signal()): Promise<string[]> {
  const result: string[] = [];
  for await (const event of sse(body, abort)) result.push(event);
  return result;
}
const encode = (text: string) => new TextEncoder().encode(text);

it('accepts split UTF-8, comments, CRLF, CR, LF and multiline data', async () => {
  const data = encode(': heartbeat\r\nevent: chunk\r\ndata: 日本語\r\ndata: second\r\n\r\ndata: [DONE]\r\r');
  expect(await collect(bytes([...data].map((byte) => Uint8Array.of(byte))))).toEqual(['日本語\nsecond', '[DONE]']);
  expect(await collect(bytes([encode('data: x\n\ndata:\n\n')]))).toEqual(['x', '']);
});

it('rejects a truncated final event, including after a complete event', async () => {
  for (const tail of ['data: incomplete\n', 'data: incomplete', 'data'])
    await expect(collect(bytes([encode('data: complete\n\n' + tail)]))).rejects.toMatchObject({
      code: 'internal',
    });
});

it('rejects malformed UTF-8 without exposing its contents', async () => {
  const result = collect(bytes([encode('data: private-canary'), Uint8Array.of(0xff)]));
  await expect(result).rejects.toMatchObject({ code: 'internal' });
  await expect(result).rejects.not.toThrow('private-canary');
});

it('bounds an unterminated event and aggregate stream bytes', async () => {
  await expect(collect(bytes([encode('data:' + 'a'.repeat(1024 * 1024))]))).rejects.toMatchObject({
    code: 'internal',
  });
  const chunk = encode('data: ' + 'a'.repeat(1024 * 512) + '\n\n');
  await expect(collect(bytes(Array<Uint8Array>(9).fill(chunk)))).rejects.toMatchObject({ code: 'internal' });
});

it('actively cancels a pending read when aborted and releases its lock', async () => {
  const controller = new AbortController();
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ cancel });
  const result = collect(body, controller.signal);
  controller.abort();
  await expect(result).rejects.toHaveProperty('name', 'AbortError');
  expect(cancel).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
});

it('cancels the transport when the consumer stops after a terminal event', async () => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encode('data: [DONE]\n\n'));
    },
    cancel,
  });
  for await (const event of sse(body, signal())) {
    expect(event).toBe('[DONE]');
    break;
  }
  expect(cancel).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
});
