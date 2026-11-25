import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BackendRegistry, createBuiltinRegistry } from './backends/registry.ts';
import { runRequest } from './backends/run.test-support.ts';
import type { RunContext } from './backends/types.ts';
import { Dispatcher } from './dispatcher.ts';
import type { RunnerEvent } from './protocol.ts';

const backends = ['claude', 'codex', 'deepseek', 'gemini', 'grok', 'muse', 'ollama'];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(backend: string) {
  const adapter = createBuiltinRegistry().find(backend)!;
  const contexts = new Map<string, RunContext>();
  const finish = new Map<string, (text: string) => void>();
  const registry = new BackendRegistry([
    {
      ...adapter,
      run: ({ id }, context) =>
        new Promise((resolve) => {
          contexts.set(id, context);
          finish.set(id, resolve);
        }),
    },
  ]);
  const events: RunnerEvent[] = [];
  const dispatcher = new Dispatcher({
    registry,
    runnerVersion: 'test',
    send: (event) => events.push(event),
    exit: vi.fn(),
  });
  const run = (id: string, workspace = '/work', timeoutMinutes?: number) =>
    dispatcher.receive({ kind: 'message', value: { ...runRequest(backend), id, workspace, timeoutMinutes } });
  const cancel = (id: string) => dispatcher.receive({ kind: 'message', value: { type: 'cancel', id } });
  return { contexts, finish, events, dispatcher, run, cancel };
}

it.each(backends)('%s は既定で24時間後も実行中で、手動停止を受け付ける', async (backend) => {
  const { contexts, finish, events, run, cancel } = setup(backend);
  run('job');
  const context = contexts.get('job')!;
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
  expect(context.signal.aborted).toBe(false);
  expect(events).toEqual([]);

  cancel('job');
  expect(context.signal.aborted).toBe(true);
  context.onPost('late');
  finish.get('job')!('late');
  await vi.advanceTimersByTimeAsync(0);
  expect(events).toMatchObject([{ id: 'job', type: 'error', code: 'cancelled' }]);
});

it.each([30, 60, 120])('%d 分を選ぶと時間切れで中断され、遅れた通知や結果は捨てる', async (minutes) => {
  const { contexts, finish, events, run, cancel } = setup('codex');
  run('job', '/work', minutes);
  const context = contexts.get('job')!;
  await vi.advanceTimersByTimeAsync(minutes * 60_000 - 1);
  expect(context.signal.aborted).toBe(false);
  expect(events).toEqual([]);

  await vi.advanceTimersByTimeAsync(1);
  expect(context.signal.aborted).toBe(true);
  expect(events).toEqual([]);
  cancel('job');
  context.onPost('late');
  context.onUsage({ model: 'late' });
  context.onActivity('late');
  context.onSkillRead?.('late');
  finish.get('job')!('late');
  await vi.advanceTimersByTimeAsync(0);
  expect(events).toEqual([
    { id: 'job', type: 'error', code: 'timeout', message: `時間切れで実行を中断しました（${minutes}分）` },
  ]);
});

it('pauses a configured run timeout while an operation approval is pending', async () => {
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const { contexts, finish, events, dispatcher, run } = setup('ollama');
  run('job', '/work', 30);
  const context = contexts.get('job')!;
  await vi.advanceTimersByTimeAsync(29 * 60_000);

  const approval = context.askApproval!({
    operation: 'run_command',
    workspace: '/work',
    detail: 'echo test',
    reason: 'test approval',
  });
  const request = events.find((event) => event.type === 'approvalRequested')!;
  await vi.advanceTimersByTimeAsync(2 * 60_000);
  expect(context.signal.aborted).toBe(false);

  dispatcher.receive({
    kind: 'message',
    value: { type: 'approvalResponse', id: 'job', requestId: request.requestId, decision: 'approved' },
  });
  await expect(approval).resolves.toBe('approved');
  await vi.advanceTimersByTimeAsync(59_999);
  expect(context.signal.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(context.signal.aborted).toBe(true);
  finish.get('job')!('late');
  await vi.advanceTimersByTimeAsync(0);
  expect(events.at(-1)).toMatchObject({ id: 'job', type: 'error', code: 'timeout' });
});

it('手動停止と正常完了は、期限のタイマーを解除する', async () => {
  const { contexts, finish, events, dispatcher, run } = setup('codex');
  run('cancelled', '/work', 30);
  run('done', '/other-work', 60);
  const cancelled = contexts.get('cancelled')!;
  const done = contexts.get('done')!;
  await vi.advanceTimersByTimeAsync(60_000);
  dispatcher.cancel('cancelled');
  finish.get('done')!('ok');

  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(1);
  expect(cancelled.signal.aborted).toBe(true);
  expect(done.signal.aborted).toBe(false);
  expect(events).toEqual([{ id: 'done', type: 'result', text: 'ok' }]);
  finish.get('cancelled')!('late');
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(0);
  expect(events).toEqual([
    { id: 'done', type: 'result', text: 'ok' },
    { id: 'cancelled', type: 'error', code: 'cancelled', message: '実行を中断しました' },
  ]);
});

it('中断を無視するバックエンドにも5秒で終端を返し、別の作業場所では実行できる', async () => {
  const { contexts, finish, events, dispatcher, run } = setup('codex');
  run('stuck', '/work', 30);
  await vi.advanceTimersByTimeAsync(30 * 60_000 + 4_999);
  expect(contexts.get('stuck')?.signal.aborted).toBe(true);
  expect(events).toEqual([]);
  dispatcher.cancel('stuck');
  await vi.advanceTimersByTimeAsync(1);
  expect(events).toEqual([
    { id: 'stuck', type: 'error', code: 'timeout', message: '時間切れで実行を中断しました（30分）' },
  ]);

  run('blocked', '/work/.');
  expect(contexts.has('blocked')).toBe(false);
  run('other', '/other-work');
  finish.get('other')!('ok');
  await vi.advanceTimersByTimeAsync(10_000);
  expect(events.slice(1)).toMatchObject([
    { id: 'blocked', type: 'error', code: 'bad_request' },
    { id: 'other', type: 'result', text: 'ok' },
  ]);
  dispatcher.shutdown();
  expect(events).toHaveLength(3);
});
