import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../credentials/store.ts', () => ({
  apiKeyEnvironment: vi.fn((_backend: string, envVar: string) => Promise.resolve({ ...process.env, [envVar]: 'saved-api-key' })),
}));

import {
  backendAuthMode,
  claudeAuthEnvironment,
  codexAuthEnvironment,
  setBackendAuthMode,
} from './auth-mode.ts';

describe('backend authentication mode', () => {
  afterEach(() => {
    setBackendAuthMode('claude', 'desktop');
    setBackendAuthMode('codex', 'desktop');
    vi.unstubAllEnvs();
  });

  it('defaults to desktop and excludes provider API keys from child environments', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'inherited-claude-key');
    vi.stubEnv('OPENAI_API_KEY', 'inherited-openai-key');

    expect(backendAuthMode('claude')).toBe('desktop');
    expect(backendAuthMode('codex')).toBe('desktop');
    expect(await claudeAuthEnvironment(process.env)).not.toHaveProperty('ANTHROPIC_API_KEY');
    expect(await codexAuthEnvironment(process.env)).not.toHaveProperty('OPENAI_API_KEY');
  });

  it('uses the credential store API key in API mode', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'inherited-claude-key');
    vi.stubEnv('OPENAI_API_KEY', 'inherited-openai-key');
    setBackendAuthMode('claude', 'api');
    setBackendAuthMode('codex', 'api');

    expect(await claudeAuthEnvironment(process.env)).toHaveProperty('ANTHROPIC_API_KEY', 'saved-api-key');
    expect(await codexAuthEnvironment(process.env)).toHaveProperty('OPENAI_API_KEY', 'saved-api-key');
  });
});
