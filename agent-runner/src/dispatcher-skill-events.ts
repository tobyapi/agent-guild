import type { RunnerEvent } from './protocol.ts';

/** Sequence belongs to this runner job. Provider call IDs are available only on some adapters. */
export function skillEvents(id: string, send: (event: RunnerEvent) => void) {
  let sequence = 0;
  return (name: string | null, toolCallId?: string): void => {
    if (name === null) send({ type: 'skillObservation', id, name });
    else
      send({ type: 'skillObservation', id, name, sequence: ++sequence, toolCallId: toolCallId ?? `host:${sequence}` });
  };
}
