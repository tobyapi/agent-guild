vi.mock('../credentials/store.ts', () => ({
  apiKeyEnvironment: (_backend: string, env = process.env) => Promise.resolve(env),
}));
import { afterEach, describe, expect, it, vi } from 'vitest';
import { museAdapter, museProvider } from './muse.ts';
import { EventReader } from './codex-runtime/events.ts';

afterEach(() => vi.unstubAllEnvs());

describe('Muse Spark provider', () => {
  it('isolates state and keeps credentials out of config without changing the environment', () => {
    const env = {
      MODEL_API_KEY: 'test-secret',
      XAI_API_KEY: 'xai-secret',
      OPENAI_API_KEY: 'other-secret',
      PATH: 'bin',
      CODEX_HOME: 'global',
    };
    const a = museProvider('/state/a', env);
    const b = museProvider('/state/b', env);
    expect(a.env.MODEL_API_KEY).toBe('test-secret');
    expect(a.env).not.toHaveProperty('OPENAI_API_KEY');
    expect(a.env).not.toHaveProperty('XAI_API_KEY');
    expect(a.env.CODEX_HOME).not.toBe(b.env.CODEX_HOME);
    expect(env.CODEX_HOME).toBe('global');
    expect(JSON.stringify(a.config)).not.toContain('test-secret');
    expect(a.config).toMatchObject({
      model_provider: 'guild_meta',
      model_providers: {
        guild_meta: {
          base_url: 'https://api.meta.ai/v1',
          env_key: 'MODEL_API_KEY',
          wire_api: 'responses',
          requires_openai_auth: false,
        },
      },
    });
    expect(a.config).toHaveProperty('features.multi_agent', false);
    expect(a.config).not.toHaveProperty('model_supports_reasoning_summaries');
  });

  it.each([undefined, '', '   '])('requires a nonblank API key (%s)', (key) => {
    expect(() => museProvider('/state', { MODEL_API_KEY: key })).toThrow(expect.objectContaining({ code: 'auth' }));
  });

  it('publishes model selection and unsupported capabilities', async () => {
    expect(museAdapter.info()).toMatchObject({
      id: 'muse',
      canLogin: false,
      capabilities: { webSearch: false },
      midRunPost: 'text',
    });
    const catalog = await museAdapter.catalog!();
    expect(catalog.defaultModel).toBe('muse-spark-1.3');
    expect(museAdapter.info().label).toContain('実験対応・実API未検証');
    expect(catalog.models[0]?.label).toContain('実験対応・実API未検証');
    expect(catalog.models[0]?.efforts).toEqual(['minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
    catalog.models.length = 0;
    expect((await museAdapter.catalog!()).models).toHaveLength(1);
  });

  it.each([
    ['401 unauthorized', 'auth'],
    ['429 rate limit', 'rate_limit'],
    ['unknown model', 'model_not_found'],
    ['invalid_api_key', 'auth'],
    ['model_not_found', 'model_not_found'],
  ])('classifies %s without exposing provider error text', (detail, code) => {
    const provider = museProvider('/state', { MODEL_API_KEY: 'secret' });
    const reader = new EventReader(vi.fn(), vi.fn(), provider.failure);
    expect(() => reader.read({ type: 'error', message: detail + ' secret' })).toThrow(
      expect.objectContaining({ code }),
    );
    expect(provider.failure(detail + ' secret').message).not.toContain('secret');
  });
});
