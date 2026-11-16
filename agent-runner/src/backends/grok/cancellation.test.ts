import { expect, it, vi } from 'vitest';
import { runLoop } from './loop.ts';
import type { Response } from './response.ts';

const response = (output: Response['output']): Response => ({
  id: 'cancel-fixture',
  status: 'completed',
  output,
  usage: { cost_in_usd_ticks: 10, input_tokens: 1, output_tokens: 1 },
});
const stages = ['before', 'during', 'after'] as const;
const local = ['read_file', 'fetch_url', 'read_skill', 'post'];

it.each(local.flatMap((name) => stages.map((stage) => ({ name, stage }))))(
  'stops $name cancellation $stage dispatch without retries or continuation',
  async ({ name, stage }) => {
    const abort = new AbortController();
    const onPost = vi.fn();
    const send = vi.fn(() => {
      if (stage === 'before') abort.abort();
      return Promise.resolve(
        response([
          { type: 'reasoning', encrypted_content: 'synthetic-cancel-state' },
          { type: 'function_call', name, call_id: 'one', arguments: '{}' },
          { type: 'function_call', name, call_id: 'two', arguments: '{}' },
        ]),
      );
    });
    const execute = vi.fn(async () => {
      if (stage === 'during') {
        await new Promise<void>((_resolve, reject) => {
          abort.signal.addEventListener('abort', () => reject(abort.signal.reason), { once: true });
          queueMicrotask(() => abort.abort());
        });
      }
      if (name === 'post') onPost('completed before cancellation');
      abort.abort();
      return 'completed';
    });
    await expect(
      runLoop({
        model: 'fixture',
        input: [],
        tools: () => [],
        send,
        execute,
        context: { signal: abort.signal, onPost, onUsage: vi.fn(), onActivity: vi.fn() },
      }),
    ).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(stage === 'before' ? 0 : 1);
    expect(onPost).toHaveBeenCalledTimes(name === 'post' && stage === 'after' ? 1 : 0);
  },
);

it.each(['web_search', 'x_search'].flatMap((name) => stages.map((stage) => ({ name, stage }))))(
  'stops server $name cancellation $stage HTTP without publishing or executing',
  async ({ name, stage }) => {
    const abort = new AbortController();
    if (stage === 'before') abort.abort();
    const execute = vi.fn();
    const onPost = vi.fn();
    const send = vi.fn(async () => {
      if (stage === 'during') {
        await new Promise<void>((_resolve, reject) => {
          abort.signal.addEventListener('abort', () => reject(abort.signal.reason), { once: true });
          queueMicrotask(() => abort.abort());
        });
      }
      abort.abort();
      return response([
        { type: `${name}_call` },
        { type: 'message', content: [{ type: 'output_text', text: 'late' }] },
      ]);
    });
    await expect(
      runLoop({
        model: 'fixture',
        input: [],
        tools: () => [{ type: name }],
        send,
        execute,
        context: { signal: abort.signal, onPost, onUsage: vi.fn(), onActivity: vi.fn() },
      }),
    ).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(stage === 'before' ? 0 : 1);
    expect(execute).not.toHaveBeenCalled();
    expect(onPost).not.toHaveBeenCalled();
  },
);
