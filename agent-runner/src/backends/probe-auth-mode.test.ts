import { afterEach, expect, it, vi } from 'vitest';

vi.mock('./claude/executable.ts', () => ({ findClaude: () => ({ path: 'claude' }), claudeNotFound: () => 'missing' }));
vi.mock('./codex-runtime/executable.ts', () => ({
  findCodex: () => ({ path: 'codex' }),
  codexNotFound: () => 'missing',
}));
vi.mock('../environment.ts', () => ({ definedEnv: () => false, fileExists: () => Promise.resolve(false) }));
vi.mock('./claude/login.ts', () => ({ CAN_LOGIN: false, claudeLoginStatus: () => Promise.resolve(false) }));
vi.mock('./codex/login.ts', () => ({ CAN_LOGIN: false, hasCodexLogin: () => Promise.resolve(false) }));
vi.mock('../credentials/store.ts', () => ({
  apiKeyEnvironment: vi.fn((_backend: string, envVar: string) =>
    Promise.resolve(process.env[envVar] ? { [envVar]: process.env[envVar] } : {}),
  ),
}));

import { setBackendAuthMode } from './auth-mode.ts';
import { probeClaude } from './claude/probe.ts';
import { probeCodex } from './codex/probe.ts';

afterEach(() => {
  setBackendAuthMode('claude', 'desktop');
  setBackendAuthMode('codex', 'desktop');
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

it('API mode reports needs_auth without a key and ready when the key is present', async () => {
  setBackendAuthMode('claude', 'api');
  setBackendAuthMode('codex', 'api');
  expect((await probeClaude()).status).toBe('needs_auth');
  expect((await probeCodex()).status).toBe('needs_auth');
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.OPENAI_API_KEY = 'test-key';
  expect((await probeClaude()).status).toBe('ready');
  expect((await probeCodex()).status).toBe('ready');
});
