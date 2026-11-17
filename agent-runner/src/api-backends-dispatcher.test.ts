import { afterEach, expect, it, vi } from 'vitest';
import { BackendRegistry } from './backends/registry.ts';
import { Dispatcher } from './dispatcher.ts';
import { parseLine } from './line-parser.ts';
import type { RunnerEvent } from './protocol.ts';
import { runRequest } from './backends/run.test-support.ts';
import {
  providers,
  events as sseEvents,
  mockFetch,
  callEvents,
  requestBody,
} from './backends/api/provider.test-support.ts';
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
it.each(providers)(
  '$id publishes distinct errors for truncated, blocked and malformed responses',
  async ({ id, envVar, adapter }) => {
    vi.mocked(apiKeyEnvironment).mockResolvedValue({ [envVar]: 'synthetic' });
    const fetcher = mockFetch(id);
    for (const [code, reason] of [
      ['response_truncated', id === 'deepseek' ? 'length' : 'MAX_TOKENS'],
      ['response_blocked', id === 'deepseek' ? 'content_filter' : 'SAFETY'],
      ['invalid_response', 'UNKNOWN'],
    ]) {
      const chunks = callEvents(id);
      const first = chunks[0] as Record<string, unknown>;
      if (id === 'deepseek') (first.choices as Record<string, unknown>[])[0]!.finish_reason = reason;
      else (first.candidates as Record<string, unknown>[])[0]!.finishReason = reason;
      fetcher.mockResolvedValueOnce(sseEvents(chunks));
      const events: RunnerEvent[] = [];
      const dispatcher = new Dispatcher({
        registry: new BackendRegistry([adapter]),
        runnerVersion: 'test',
        send: (event) => events.push(event),
        exit: vi.fn(),
      });
      dispatcher.receive(parseLine(JSON.stringify(runRequest(id))));
      await vi.waitFor(() => expect(events.some((event) => event.type === 'error' && event.id === 'j')).toBe(true));
      const error = events.find((event) => event.type === 'error' && event.id === 'j');
      expect(error).toMatchObject({ type: 'error', code });
      expect(error?.type === 'error' && typeof error.message === 'string' && error.message.length > 0).toBe(true);
      expect(events.some((event) => event.type === 'result' || event.type === 'post')).toBe(false);
      expect(JSON.stringify(events)).not.toMatch(/synthetic|private-thought|opaque-signature/);
    }
  },
);
it('gemini continues unsigned tool responses without adding or dropping parts', async () => {
  const { adapter } = providers[1];
  vi.mocked(apiKeyEnvironment).mockResolvedValue({ GEMINI_API_KEY: 'synthetic' });
  const fetcher = mockFetch('gemini');
  const parts = [{ functionCall: { id: 'unsigned-1', name: 'post', args: { text: 'progress' } } }];
  fetcher.mockResolvedValueOnce(
    sseEvents([{ candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }] }]),
  );
  const events: RunnerEvent[] = [];
  const dispatcher = new Dispatcher({
    registry: new BackendRegistry([adapter]),
    runnerVersion: 'test',
    send: (event) => events.push(event),
    exit: vi.fn(),
  });
  dispatcher.receive(parseLine(JSON.stringify(runRequest('gemini'))));
  await vi.waitFor(() => expect(events.some((event) => event.type === 'result' && event.id === 'j')).toBe(true));
  expect(events).toContainEqual({ type: 'post', id: 'j', text: 'progress' });
  expect(requestBody(fetcher, 1).contents).toContainEqual({ role: 'model', parts });
  expect(events).toContainEqual({ type: 'result', id: 'j', text: 'hello back' });
});
