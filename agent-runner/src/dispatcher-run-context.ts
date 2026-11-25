import type { RunContext } from './backends/types.ts';
import { currentEvents, skillEvents } from './dispatcher-skill-events.ts';
import type { JobTimeBudget } from './job-time-budget.ts';
import type { OperationApprovals } from './operation-approvals.ts';
import type { RunnerEvent } from './protocol.ts';

export function runContext(
  id: string,
  signal: AbortSignal,
  isCurrent: () => boolean,
  emit: (event: RunnerEvent) => void,
  approvals: OperationApprovals,
  budget?: JobTimeBudget,
): RunContext {
  const send = currentEvents(isCurrent, emit);
  return {
    signal,
    onActivity: (detail) => send({ type: 'activity', id, detail }),
    onPost: (text) => send({ type: 'post', id, text }),
    onUsage: (usage) => send({ type: 'usage', id, usage }),
    onSkillRead: skillEvents(id, send),
    askApproval: (operation) => {
      if (!isCurrent()) return Promise.resolve('cancelled');
      const ask = () => approvals.ask(id, operation, signal);
      return budget ? budget.pauseFor(ask) : ask();
    },
  };
}
