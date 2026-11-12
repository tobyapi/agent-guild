vi.mock('../credentials/store.ts', () => ({
  apiKeyEnvironment: (_backend: string, _envVar: string, env = process.env) => Promise.resolve(env),
}));
import { afterEach, describe, expect, it, vi } from 'vitest';
import { grokAdapter, grokProvider } from './grok.ts';
import { EventReader } from './codex-runtime/events.ts';

afterEach(() => vi.unstubAllEnvs());

describe('Grok provider', () => {
  it('isolates state and keeps credentials out of config without changing the environment', () => {
    const env = { XAI_API_KEY: 'test-secret', OPENAI_API_KEY: 'other-secret', PATH: 'bin', CODEX_HOME: 'global' };
    const a = grokProvider('/state/a', env);
    const b = grokProvider('/state/b', env);
    expect(a.env.XAI_API_KEY).toBe('test-secret');
    expect(a.env).not.toHaveProperty('OPENAI_API_KEY');
    expect(a.env.CODEX_HOME).not.toBe(b.env.CODEX_HOME);
    expect(env.CODEX_HOME).toBe('global');
    expect(JSON.stringify(a.config)).not.toContain('test-secret');
    expect(a.config).toMatchObject({
      model_provider: 'guild_xai',
      model_providers: {
        guild_xai: {
          base_url: 'https://api.x.ai/v1',
          env_key: 'XAI_API_KEY',
          wire_api: 'responses',
          requires_openai_auth: false,
        },
      },
    });
    expect(a.config).toMatchObject({ model_reasoning_summary: 'none', features: { multi_agent: false } });
  });

  it.each([undefined, '', '   '])('requires a nonblank API key (%s)', (key) => {
    expect(() => grokProvider('/state', { XAI_API_KEY: key })).toThrow(expect.objectContaining({ code: 'auth' }));
  });

  it('publishes model selection and unsupported capabilities', async () => {
    expect(grokAdapter.info()).toMatchObject({
      id: 'grok',
      folderScope: 'sandbox',
      toolsOption: null,
      local: false,
      setup: { install: null, start: null, login: null, apiKey: { envVar: 'XAI_API_KEY' } },
      capabilities: { webSearch: false },
      midRunPost: 'text',
    });
    expect(grokAdapter.info().label).toContain('実験対応・実API未検証');
    const catalog = await grokAdapter.catalog!();
    expect(catalog.defaultModel).toBe('grok-4.7');
    expect(catalog.models[0]?.label).toContain('実験対応・実API未検証');
    expect(catalog.models[0]?.efforts).toEqual(['low', 'medium', 'high', 'xhigh']);
    catalog.models.length = 0;
    expect((await grokAdapter.catalog!()).models).toHaveLength(1);
  });

  it.each([
    ['401 unauthorized', 'auth'],
    ['429 rate limit', 'rate_limit'],
    ['unknown model', 'model_not_found'],
  ])('classifies %s without exposing provider error text', (detail, code) => {
    const provider = grokProvider('/state', { XAI_API_KEY: 'secret' });
    const reader = new EventReader(vi.fn(), vi.fn(), provider.failure);
    expect(() => reader.read({ type: 'error', message: detail + ' secret' })).toThrow(
      expect.objectContaining({ code }),
    );
    expect(provider.failure(detail + ' secret').message).not.toContain('secret');
  });
});
