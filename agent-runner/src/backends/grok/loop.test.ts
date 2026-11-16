import { expect, it, vi } from 'vitest';
import { runLoop } from './loop.ts';
import type { Response } from './response.ts';

const context = () => ({
  signal: new AbortController().signal,
  onPost: vi.fn(),
  onUsage: vi.fn(),
  onActivity: vi.fn(),
});
const result = (id: string, output: Response['output']): Response => ({
  id,
  status: 'completed',
  output,
  usage: { cost_in_usd_ticks: 12, input_tokens: 2, output_tokens: 3 },
});
const reasoning = { type: 'reasoning', encrypted_content: 'synthetic-encrypted-state' };
const call = { type: 'function_call', call_id: 'call-1', name: 'read_file', arguments: '{"path":"fixture.txt"}' };
const message = { type: 'message', content: [{ type: 'output_text', text: 'done' }] };

it('replays encrypted state and matching tool output without previous_response_id', async () => {
  const send = vi
    .fn()
    .mockResolvedValueOnce(result('one', [reasoning, call]))
    .mockResolvedValueOnce(result('two', [message]));
  const execute = vi.fn().mockResolvedValue('fixture');
  const final = await runLoop({
    model: 'grok-4.7',
    input: [{ role: 'user', content: 'test' }],
    tools: () => [],
    execute,
    send,
    context: context(),
  });
  expect(final.text).toBe('done');
  expect(final.usage.ticks).toBe(24);
  expect(send.mock.calls[1]?.[0]).toMatchObject({ include: ['reasoning.encrypted_content'] });
  // Transport serialization happens before finally clears the job history.
  expect(execute).toHaveBeenCalledExactlyOnceWith('read_file', '{"path":"fixture.txt"}', 'call-1');
});

it('stops before execution or continuation when encrypted reasoning is absent', async () => {
  const send = vi.fn().mockResolvedValue(result('one', [{ type: 'reasoning' }, call]));
  const execute = vi.fn();
  await expect(
    runLoop({ model: 'test', input: [], tools: () => [], execute, send, context: context() }),
  ).rejects.toThrow('encrypted');
  expect(execute).not.toHaveBeenCalled();
  expect(send).toHaveBeenCalledTimes(1);
});

it.each([12, 13])('stops next request at or above the job budget (%i ticks)', async (ticks) => {
  const response = result('one', [reasoning, call]);
  response.usage.cost_in_usd_ticks = ticks;
  const send = vi.fn().mockResolvedValue(response);
  await expect(
    runLoop({
      model: 'test',
      input: [],
      tools: () => [],
      execute: () => Promise.resolve('ok'),
      send,
      context: context(),
      budgetTicks: 12,
    }),
  ).rejects.toMatchObject({ code: 'rate_limit' });
  expect(send).toHaveBeenCalledTimes(1);
});

it('retains matching replay input, executes duplicate calls once, and releases history', async () => {
  const serialized: string[] = [];
  const queue = [result('one', [reasoning, call, call]), result('two', [reasoning, call]), result('three', [message])];
  const send = vi.fn((body: Record<string, unknown>) => {
    serialized.push(JSON.stringify(body));
    return Promise.resolve(queue.shift()!);
  });
  const execute = vi.fn().mockResolvedValue('fixture');
  await runLoop({ model: 'test', input: [], tools: () => [], execute, send, context: context() });
  expect(execute).toHaveBeenCalledTimes(1);
  const replay: unknown = JSON.parse(serialized[1]!);
  expect(replay).toMatchObject({
    input: [
      reasoning,
      call,
      call,
      { type: 'function_call_output', call_id: 'call-1', output: 'fixture' },
      { type: 'function_call_output', call_id: 'call-1', output: 'fixture' },
    ],
  });
  expect(send.mock.calls[0]![0].input).toEqual([]);
});
it.each(
  [
    [call, { ...call, arguments: '{}' }],
    [{ ...call, call_id: '' }],
    [{ type: 'custom_tool_call', name: 'post', call_id: 'fake', input: 'bad' }],
    [{ type: 'function_call_output', call_id: 'orphan', output: 'bad' }],
  ].map((output) => ({ output })),
)('rejects conflicting, empty or forged calls', async ({ output }) => {
  const execute = vi.fn().mockResolvedValue('ok');
  const send = vi.fn().mockResolvedValue(result('one', [reasoning, ...output]));
  await expect(
    runLoop({ model: 'test', input: [], tools: () => [], execute, send, context: context() }),
  ).rejects.toThrow();
  expect(execute.mock.calls.length).toBeLessThanOrEqual(1);
  expect(send).toHaveBeenCalledTimes(1);
});
it('does not execute or continue after cancellation following HTTP', async () => {
  const abort = new AbortController();
  const ctx = { ...context(), signal: abort.signal };
  const execute = vi.fn();
  const send = vi.fn(() => {
    abort.abort();
    return Promise.resolve(result('one', [reasoning, call]));
  });
  await expect(runLoop({ model: 'test', input: [], tools: () => [], execute, send, context: ctx })).rejects.toThrow();
  expect(execute).not.toHaveBeenCalled();
});
it('never retries an interrupted local execution', async () => {
  const execute = vi.fn().mockRejectedValue(new Error('interrupted'));
  const send = vi.fn().mockResolvedValue(result('one', [reasoning, call]));
  await expect(
    runLoop({ model: 'test', input: [], tools: () => [], execute, send, context: context() }),
  ).rejects.toThrow();
  expect(send).toHaveBeenCalledTimes(1);
  expect(execute).toHaveBeenCalledTimes(1);
});
