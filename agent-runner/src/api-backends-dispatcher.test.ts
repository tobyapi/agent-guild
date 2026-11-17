import { afterEach, expect, it, vi } from 'vitest';
import { BackendRegistry } from './backends/registry.ts';
import { Dispatcher } from './dispatcher.ts';
import { parseLine } from './line-parser.ts';
import type { RunnerEvent } from './protocol.ts';
import { runRequest } from './backends/run.test-support.ts';
import { providers, mockFetch } from './backends/api/provider.test-support.ts';
import { apiKeyEnvironment, manageApiKey } from './credentials/store.ts';

vi.mock('./credentials/store.ts', () => ({ apiKeyEnvironment: vi.fn(), manageApiKey: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it.each(providers)(
  '$id accepts the existing key and run protocol and publishes only the final response',
  async ({ id, envVar, adapter }) => {
    vi.mocked(apiKeyEnvironment).mockResolvedValue({ [envVar]: 'synthetic' });
    vi.mocked(manageApiKey).mockResolvedValue('{"source":"saved","supported":true}');
    mockFetch(id);
    const events: RunnerEvent[] = [];
    const dispatcher = new Dispatcher({
      registry: new BackendRegistry([adapter]),
      runnerVersion: 'test',
      send: (event) => events.push(event),
      exit: vi.fn(),
    });
    dispatcher.receive(
      parseLine(JSON.stringify({ type: 'apiKey', id: 'key', backend: id, action: 'set', key: 'synthetic' })),
    );
    await vi.waitFor(() => expect(events.some((event) => event.type === 'result' && event.id === 'key')).toBe(true));
    expect(manageApiKey).toHaveBeenCalledWith(id, envVar, 'set', 'synthetic');
    dispatcher.receive(parseLine(JSON.stringify(runRequest(id))));
    await vi.waitFor(() => expect(events.some((event) => event.type === 'result' && event.id === 'j')).toBe(true));
    expect(events).toContainEqual({ type: 'result', id: 'j', text: 'hello back' });
    expect(events.some((event) => event.type === 'skillObservation' && event.name === null)).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/synthetic|private-thought|opaque-signature/);
  },
);
