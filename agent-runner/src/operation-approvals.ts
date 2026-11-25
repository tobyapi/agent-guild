import { randomUUID } from 'node:crypto';
import type { ApprovalOutcome, ApprovalResponse, OperationApproval } from './protocol-approval.ts';
import type { RunnerEvent } from './protocol.ts';

export const APPROVAL_TIMEOUT_MS = 10 * 60_000;

type Pending = {
  id: string;
  deadline: number;
  finish: (outcome: ApprovalOutcome) => void;
};

export class OperationApprovals {
  readonly #pending = new Map<string, Pending>();
  readonly #send: (event: RunnerEvent) => void;

  constructor(send: (event: RunnerEvent) => void) {
    this.#send = send;
  }

  ask(id: string, operation: OperationApproval, signal: AbortSignal): Promise<ApprovalOutcome> {
    if (signal.aborted) return Promise.resolve('cancelled');
    const requestId = randomUUID();
    return new Promise((resolve) => {
      const deadline = performance.now() + APPROVAL_TIMEOUT_MS;
      const finish = (outcome: ApprovalOutcome) => {
        if (!this.#pending.delete(requestId)) return;
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        this.#send({ type: 'approvalResolved', id, requestId, outcome });
        resolve(outcome);
      };
      const abort = () => finish('cancelled');
      const timer = setTimeout(() => finish('timedOut'), APPROVAL_TIMEOUT_MS);
      this.#pending.set(requestId, { id, deadline, finish });
      signal.addEventListener('abort', abort, { once: true });
      this.#send({ ...operation, type: 'approvalRequested', id, requestId, timeoutMs: APPROVAL_TIMEOUT_MS });
    });
  }

  cancelRun(id: string): void {
    for (const pending of this.#pending.values()) {
      if (pending.id === id) pending.finish('cancelled');
    }
  }

  respond({ id, requestId, decision }: ApprovalResponse): void {
    const pending = this.#pending.get(requestId);
    if (pending?.id !== id) return;
    pending.finish(performance.now() >= pending.deadline ? 'timedOut' : decision);
  }
}
