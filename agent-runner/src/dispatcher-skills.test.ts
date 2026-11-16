import { expect, it, vi } from 'vitest';
import { BackendRegistry } from './backends/registry.ts';
import { PLAIN } from './backends/descriptor.test-support.ts';
import { runRequest } from './backends/run.test-support.ts';
import type { BackendAdapter, RunContext } from './backends/types.ts';
import { Dispatcher } from './dispatcher.ts';
import { parseLine } from './line-parser.ts';
import type { RunnerEvent } from './protocol.ts';

it('keeps concurrent read observations on their own job and drops cancelled or completed callbacks', async () => {
  const contexts = new Map<string, RunContext>();
  const finish = new Map<string, (text: string) => void>();
  const adapter: BackendAdapter = {
    info: () => ({
      id: 'fixture',
      label: 'Fixture',
      capabilities: runRequest('fixture').permissions,
      options: [],
      permissionRules: [],
      leakRisks: [],
      unrestricted: [],
      midRunPost: 'tool',
      ...PLAIN,
    }),
    probe: () => Promise.resolve({ status: 'ready', statusMessage: '' }),
    run: (request, context) =>
      new Promise((resolve) => {
        contexts.set(request.id, context);
        finish.set(request.id, resolve);
      }),
  };
  const events: RunnerEvent[] = [];
  const dispatcher = new Dispatcher({
    registry: new BackendRegistry([adapter]),
    runnerVersion: 'test',
    send: (e) => events.push(e),
    exit: vi.fn(),
  });
  for (const id of ['parent', 'child']) dispatcher.receive(parseLine(JSON.stringify({ ...runRequest('fixture'), id })));
  contexts.get('parent')!.onSkillRead?.('parent-skill');
  contexts.get('child')!.onSkillRead?.('child-skill');
  dispatcher.receive(parseLine(JSON.stringify({ type: 'cancel', id: 'parent' })));
  contexts.get('parent')!.onSkillRead?.('cancelled-late');
  finish.get('child')!('done');
  finish.get('parent')!('cancelled');
  await new Promise((resolve) => setImmediate(resolve));
  contexts.get('child')!.onSkillRead?.('completed-late');
  expect(events.filter((e) => e.type === 'skillObservation')).toEqual([
    { type: 'skillObservation', id: 'parent', name: 'parent-skill' },
    { type: 'skillObservation', id: 'child', name: 'child-skill' },
  ]);
});
