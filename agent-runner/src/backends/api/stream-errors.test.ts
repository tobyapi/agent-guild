import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiKeyEnvironment } from '../../credentials/store.ts';
import { runRequest, runContext } from '../run.test-support.ts';
import { providers, events, callEvents, mockFetch } from './provider.test-support.ts';

vi.mock('../../credentials/store.ts', () => ({ apiKeyEnvironment: vi.fn() }));
beforeEach(() =>
  vi.mocked(apiKeyEnvironment).mockResolvedValue({ DEEPSEEK_API_KEY: 'synthetic', GEMINI_API_KEY: 'synthetic' }),
);
afterEach(() => vi.unstubAllGlobals());
describe.each(providers)('$id stream errors', ({ id, adapter }) => {
  it('classifies documented terminal reasons without posting or continuing tools', async () => {
    const fetcher = mockFetch(id);
    const cases =
      id === 'deepseek'
        ? [
            ...['length', 'insufficient_system_resource', 'aborted'].map((reason) => [reason, 'response_truncated']),
            ['content_filter', 'response_blocked'],
            ['UNKNOWN', 'invalid_response'],
          ]
        : [
            ['MAX_TOKENS', 'response_truncated'],
            ...[
              'SAFETY',
              'RECITATION',
              'LANGUAGE',
              'BLOCKLIST',
              'PROHIBITED_CONTENT',
              'SPII',
              'IMAGE_SAFETY',
              'IMAGE_PROHIBITED_CONTENT',
            ].map((reason) => [reason, 'response_blocked']),
            ...['OTHER', 'MALFORMED_FUNCTION_CALL', 'FINISH_REASON_UNSPECIFIED', 'UNKNOWN'].map((reason) => [
              reason,
              'invalid_response',
            ]),
          ];
    for (const [reason, code] of cases) {
      const chunks =
        id === 'deepseek'
          ? [{ choices: [{ index: 0, delta: { content: 'private-canary' }, finish_reason: reason }] }, '[DONE]']
          : [
              {
                candidates: [{ content: { role: 'model', parts: [{ text: 'private-canary' }] }, finishReason: reason }],
              },
            ];
      fetcher.mockResolvedValueOnce(events(chunks));
      const context = runContext();
      const result = adapter.run(runRequest(id), context);
      await expect(result).rejects.toMatchObject({ code });
      await expect(result).rejects.not.toThrow('private-canary');
      expect(context.onPost).not.toHaveBeenCalled();
    }
    expect(fetcher).toHaveBeenCalledTimes(cases.length);
  });
  it('does not execute partial tool calls or an unterminated stream', async () => {
    const fetcher = mockFetch(id);
    const values = callEvents(id);
    const first = values[0]!;
    const text = `data: ${JSON.stringify(first)}`;
    fetcher.mockResolvedValue(new Response(text, { headers: { 'Content-Type': 'text/event-stream' } }));
    const context = runContext();
    await expect(adapter.run(runRequest(id), context)).rejects.toThrow();
    expect(context.onPost).not.toHaveBeenCalled();
  });
  it('refuses truncated, blocked, token-limited and provider-error streams', async () => {
    const fetcher = mockFetch(id);
    const broken =
      id === 'deepseek'
        ? [
            [{ choices: [{ index: 0, delta: { content: 'partial' } }] }],
            [{ choices: [{ index: 0, delta: {}, finish_reason: 'length' }] }, '[DONE]'],
          ]
        : [
            [{ candidates: [{ content: { role: 'model', parts: [{ text: 'partial' }] } }] }],
            [{ candidates: [{ finishReason: 'MAX_TOKENS' }] }],
            [{ promptFeedback: { blockReason: 'SAFETY' } }],
          ];
    for (const chunks of [...broken, [{ error: { message: 'synthetic-secret' } }]]) {
      fetcher.mockResolvedValueOnce(events(chunks));
      const context = runContext();
      const result = adapter.run(runRequest(id), context);
      await expect(result).rejects.toThrow();
      await expect(result).rejects.not.toThrow('synthetic-secret');
      expect(context.onPost).not.toHaveBeenCalled();
    }
  });
  it('cancels a pending body read and releases the connection without post or retry', async () => {
    const fetcher = mockFetch(id);
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          started();
        },
        cancel,
      },
      { highWaterMark: 0 },
    );
    fetcher.mockResolvedValueOnce(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
    const abort = new AbortController();
    const context = runContext(abort.signal);
    const result = adapter.run(runRequest(id), context);
    await ready;
    abort.abort();
    await expect(result).rejects.toThrow();
    expect(cancel).toHaveBeenCalledOnce();
    expect(context.onPost).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
