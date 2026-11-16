import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { grokAdapter } from './grok.ts';
import { runRequest, runContext } from './run.test-support.ts';
import { apiKeyEnvironment } from '../credentials/store.ts';

vi.mock('../credentials/store.ts', () => ({ apiKeyEnvironment: vi.fn() }));
const response = () => ({
  id: 'response',
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text: 'hello back' }] }],
  usage: { cost_in_usd_ticks: 123, input_tokens: 2, output_tokens: 3 },
});
type Options = { body: string; headers: { Authorization: string } };
let fetcher: ReturnType<typeof vi.fn<(url: string, options: Options) => Promise<Response>>>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiKeyEnvironment).mockResolvedValue({ XAI_API_KEY: 'synthetic-canary-key' });
  fetcher = vi
    .fn<(url: string, options: Options) => Promise<Response>>()
    .mockImplementation(() => Promise.resolve(Response.json(response())));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => vi.unstubAllGlobals());

it('uses direct HTTPS with store=false, no Codex or prior response ID, and reports usage', async () => {
  const context = runContext();
  expect(await grokAdapter.run(runRequest('grok'), context)).toBe('hello back');
  const [url, options] = fetcher.mock.calls[0]!;
  expect(url).toBe('https://api.x.ai/v1/responses');
  const body: unknown = JSON.parse(options.body);
  expect(body).toMatchObject({
    model: 'grok-4.7',
    store: false,
    stream: false,
    include: ['reasoning.encrypted_content'],
  });
  expect(body).not.toHaveProperty('previous_response_id');
  expect(JSON.stringify(body)).not.toContain('synthetic-canary-key');
  expect(options.headers.Authorization).toBe('Bearer synthetic-canary-key');
  expect(context.onUsage).toHaveBeenCalledWith({
    model: 'grok-4.7',
    inputTokens: 2,
    outputTokens: 3,
    estimatedCostNanoUsd: 12,
  });
});
it('uses selected model and reloads credentials for every run', async () => {
  await grokAdapter.run({ ...runRequest('grok'), model: 'selected-model' }, runContext());
  vi.mocked(apiKeyEnvironment).mockResolvedValue({ XAI_API_KEY: 'replacement' });
  await grokAdapter.run(runRequest('grok'), runContext());
  expect(JSON.parse(fetcher.mock.calls[0]![1].body) as unknown).toMatchObject({ model: 'selected-model' });
  expect(fetcher.mock.calls[1]![1].headers.Authorization).toBe('Bearer replacement');
});
it.each([
  [401, 'auth'],
  [403, 'auth'],
  [429, 'rate_limit'],
  [404, 'model_not_found'],
  [500, 'internal'],
])('sanitizes HTTP %i including reflected keys', async (status, code) => {
  fetcher.mockImplementation(() =>
    Promise.resolve(
      new Response('synthetic-canary-key', {
        status: Number(status),
        headers: { 'x-reflect': 'synthetic-canary-key' },
      }),
    ),
  );
  const result = grokAdapter.run(runRequest('grok'), runContext());
  await expect(result).rejects.toMatchObject({ code });
  await expect(result).rejects.not.toThrow('synthetic-canary-key');
});
it('refuses missing key or a failed credential store without environment fallback', async () => {
  vi.mocked(apiKeyEnvironment).mockResolvedValue({});
  await expect(grokAdapter.run(runRequest('grok'), runContext())).rejects.toMatchObject({ code: 'auth' });
  vi.mocked(apiKeyEnvironment).mockRejectedValue(new Error('synthetic-canary-key'));
  await expect(grokAdapter.run(runRequest('grok'), runContext())).rejects.toThrow(
    'Grok credential store is unavailable.',
  );
  expect(fetcher).not.toHaveBeenCalled();
});
it('cancels before HTTP and propagates active HTTP cancellation', async () => {
  const abort = new AbortController();
  abort.abort();
  await expect(grokAdapter.run(runRequest('grok'), runContext(abort.signal))).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  const active = new AbortController();
  fetcher.mockImplementation(() => {
    active.abort();
    return Promise.reject(new Error('synthetic-canary-key'));
  });
  await expect(grokAdapter.run(runRequest('grok'), runContext(active.signal))).rejects.not.toThrow(
    'synthetic-canary-key',
  );
});
