import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiKeyEnvironment } from '../../credentials/store.ts';
import { createBuiltinRegistry } from '../registry.ts';
import { runRequest, runContext } from '../run.test-support.ts';
import { setLanguage, LANGUAGES } from '../../i18n.ts';
import { providers, mockFetch, requestBody } from './provider.test-support.ts';

vi.mock('../../credentials/store.ts', () => ({ apiKeyEnvironment: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiKeyEnvironment).mockResolvedValue({
    DEEPSEEK_API_KEY: 'synthetic-deepseek',
    GEMINI_API_KEY: 'synthetic-gemini',
    GOOGLE_API_KEY: 'synthetic-other',
    MODEL_API_KEY: 'synthetic-other',
    OPENAI_API_KEY: 'synthetic-other',
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  setLanguage('ja');
});

describe.each(providers)('$id adapter', ({ id, envVar, adapter }) => {
  it('is registered and declares the API key, bounded capabilities and actual model efforts', async () => {
    expect(createBuiltinRegistry().find(id)).toBe(adapter);
    expect(adapter.info()).toMatchObject({
      setup: { apiKey: { envVar }, login: null },
      capabilities: { webSearch: false, writeFiles: false, runCommands: false },
      midRunPost: 'tool',
    });
    const catalog = await adapter.catalog!();
    expect(catalog.models.find((m) => m.id === catalog.defaultModel)?.tools).toBe(true);
    for (const language of LANGUAGES) {
      setLanguage(language);
      expect((await adapter.catalog!()).models[0]!.description).toContain('MEMORY.md');
      expect((await adapter.probe()).statusMessage.length).toBeGreaterThan(10);
    }
  });
  it('assembles streaming text, hides reasoning, reports tokens and reloads only the selected key', async () => {
    const fetcher = mockFetch(id);
    const context = runContext();
    expect(await adapter.run(runRequest(id), context)).toBe('hello back');
    expect(apiKeyEnvironment).toHaveBeenLastCalledWith(id, envVar);
    expect(context.onUsage).toHaveBeenCalledWith({
      model: (await adapter.catalog!()).defaultModel,
      inputTokens: 2,
      outputTokens: 3,
    });
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toMatch(
      id === 'deepseek'
        ? /^https:\/\/api.deepseek.com\/chat\/completions$/
        : /^https:\/\/generativelanguage.googleapis.com\/v1beta\/models\/gemini-4-hydrogen:streamGenerateContent\?alt=sse$/,
    );
    expect(JSON.stringify(options?.headers)).toContain(`synthetic-${id}`);
    expect(JSON.stringify(options)).not.toContain('synthetic-other');
    expect(JSON.stringify(requestBody(fetcher))).not.toContain('synthetic-');
    expect(options?.redirect).toBe('error');
    expect(options?.signal).toBe(context.signal);
    expect(JSON.stringify(vi.mocked(context.onPost).mock.calls)).not.toContain('private-thought');
    vi.mocked(apiKeyEnvironment).mockResolvedValue({ [envVar]: 'replacement' });
    await adapter.run(runRequest(id), runContext());
    expect(JSON.stringify(fetcher.mock.calls[1]![1]?.headers)).toContain('replacement');
  });
  it('does no network probe and treats missing keys / store failure as auth without another-key fallback', async () => {
    const fetcher = mockFetch(id);
    expect((await adapter.probe()).status).toBe('ready');
    expect(fetcher).not.toHaveBeenCalled();
    vi.mocked(apiKeyEnvironment).mockResolvedValue({ GOOGLE_API_KEY: 'synthetic-other' });
    expect((await adapter.probe()).status).toBe('needs_auth');
    await expect(adapter.run(runRequest(id), runContext())).rejects.toMatchObject({ code: 'auth' });
    vi.mocked(apiKeyEnvironment).mockRejectedValue(new Error('synthetic-other'));
    const failed = adapter.run(runRequest(id), runContext());
    await expect(failed).rejects.toMatchObject({ code: 'auth' });
    await expect(failed).rejects.not.toThrow('synthetic-other');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [404, 'model_not_found'],
    [429, 'rate_limit'],
    [500, 'internal'],
  ] as const)('sanitizes HTTP %i', async (status, code) => {
    const fetcher = mockFetch(id);
    fetcher.mockResolvedValue(new Response('synthetic-other', { status }));
    const result = adapter.run(runRequest(id), runContext());
    await expect(result).rejects.toMatchObject({ code });
    await expect(result).rejects.not.toThrow('synthetic-other');
  });
  it('sanitizes network errors and rejects unsupported model, effort and image input before HTTP', async () => {
    const fetcher = mockFetch(id);
    fetcher.mockRejectedValue(new Error('synthetic-other'));
    await expect(adapter.run(runRequest(id), runContext())).rejects.not.toThrow('synthetic-other');
    fetcher.mockClear();
    for (const extra of [
      { model: 'unknown' },
      { options: { effort: 'ultra' } },
      { images: [{ path: '/image', mediaType: 'image/png' }] },
    ])
      await expect(adapter.run({ ...runRequest(id), ...extra }, runContext())).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
