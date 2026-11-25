import { afterEach, expect, it, vi } from 'vitest';
import { JobTimeBudget } from './job-time-budget.ts';
import { APPROVAL_TIMEOUT_MS, OperationApprovals } from './operation-approvals.ts';
import type { ApprovalDecision } from './protocol-approval.ts';
import type { RunnerEvent } from './protocol.ts';

const payload = {
  operation: 'run_command',
  workspace: '/ws',
  detail: 'echo hello\necho world',
  reason: 'Outside scope',
};

function setup() {
  const events: RunnerEvent[] = [];
  const approvals = new OperationApprovals((event) => events.push(event));
  function ask(id: string, signal = new AbortController().signal) {
    const promise = approvals.ask(id, payload, signal);
    const event = events.at(-1);
    if (event?.type !== 'approvalRequested') throw new Error('missing approval request');
    expect(event).toMatchObject({ id, ...payload, timeoutMs: 600_000 });
    expect(event.requestId).toMatch(/^[a-f0-9-]{36}$/u);
    return { requestId: event.requestId, promise };
  }
  const respond = (id: string, requestId: string, decision: ApprovalDecision = 'approved') =>
    approvals.respond({ type: 'approvalResponse', id, requestId, decision });
  return { ask, respond, events };
}

afterEach(() => vi.useRealTimers());

it('matches each exact run and request, consumes responses once, and allows independent pending requests', async () => {
  const { ask, respond, events } = setup();
  const first = ask('run');
  const second = ask('run');
  const other = ask('other-run');
  expect(new Set([first.requestId, second.requestId, other.requestId]).size).toBe(3);
  respond('run', 'unknown');
  respond('other-run', first.requestId);
  respond('run', other.requestId);
  expect(events).toHaveLength(3);
  respond('run', second.requestId, 'denied');
  respond('run', first.requestId);
  respond('run', second.requestId);
  respond('other-run', other.requestId);
  await expect(first.promise).resolves.toBe('approved');
  await expect(second.promise).resolves.toBe('denied');
  await expect(other.promise).resolves.toBe('approved');
  expect(events.slice(3)).toEqual([
    { type: 'approvalResolved', id: 'run', requestId: second.requestId, outcome: 'denied' },
    { type: 'approvalResolved', id: 'run', requestId: first.requestId, outcome: 'approved' },
    { type: 'approvalResolved', id: 'other-run', requestId: other.requestId, outcome: 'approved' },
  ]);
});

it('expires after ten minutes and ignores a late approval', async () => {
  vi.useFakeTimers();
  const { ask, respond, events } = setup();
  const { promise, requestId } = ask('run');
  vi.advanceTimersByTime(APPROVAL_TIMEOUT_MS - 1);
  expect(events).toHaveLength(1);
  vi.advanceTimersByTime(1);
  await expect(promise).resolves.toBe('timedOut');
  respond('run', requestId);
  expect(events).toHaveLength(2);
});

it('cancels every wait in an aborted run and ignores an approval sent afterwards', async () => {
  const { ask, respond, events } = setup();
  const controller = new AbortController();
  const first = ask('run', controller.signal);
  const second = ask('run', controller.signal);
  controller.abort();
  respond('run', first.requestId);
  expect(await Promise.all([first.promise, second.promise])).toEqual(['cancelled', 'cancelled']);
  expect(events).toHaveLength(4);
});

it('preserves the run time budget while overlapping approvals wait', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const expired = vi.fn();
  const budget = new JobTimeBudget(1, expired);
  vi.advanceTimersByTime(10_000);
  let releaseFirst!: () => void;
  let releaseSecond!: () => void;
  const first = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const second = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  const pauses = [budget.pauseFor(() => first), budget.pauseFor(() => second)];
  vi.advanceTimersByTime(APPROVAL_TIMEOUT_MS / 2);
  releaseSecond();
  await pauses[1];
  vi.advanceTimersByTime(APPROVAL_TIMEOUT_MS / 2);
  expect(expired).not.toHaveBeenCalled();
  releaseFirst();
  await pauses[0];
  vi.advanceTimersByTime(49_999);
  expect(expired).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(expired).toHaveBeenCalledTimes(1);
});

it('drops orphaned requests when the adapter returns, without closing another run’s request', async () => {
  const events: RunnerEvent[] = [];
  const approvals = new OperationApprovals((event) => events.push(event));
  const signal = new AbortController().signal;
  const orphaned = approvals.ask('finished', payload, signal);
  const active = approvals.ask('active', payload, signal);
  approvals.cancelRun('finished');
  await expect(orphaned).resolves.toBe('cancelled');
  expect(events).toHaveLength(3);
  approvals.cancelRun('active');
  await expect(active).resolves.toBe('cancelled');
});
