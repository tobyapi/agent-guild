import { beforeEach, expect, it, vi } from 'vitest';
import { apiKeyEnvironment } from '../credentials/store.ts';
import { findCodex } from './codex-runtime/executable.ts';
import { grokAdapter } from './grok.ts';
import { BackendRegistry } from './registry.ts';
import { BackendError } from './types.ts';

vi.mock('../credentials/store.ts', () => ({ apiKeyEnvironment: vi.fn() }));
vi.mock('./codex-runtime/executable.ts', () => ({ findCodex: vi.fn(), CODEX_NOT_FOUND: 'CLI unavailable' }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findCodex).mockReturnValue({ path: 'test-codex', pathDirs: [] });
});

it('reads the Grok credential environment on every recheck', async () => {
  vi.mocked(apiKeyEnvironment).mockResolvedValueOnce({}).mockResolvedValueOnce({ XAI_API_KEY: 'dummy-saved-key' });
  expect(await grokAdapter.probe()).toMatchObject({ status: 'needs_auth' });
  const result = await grokAdapter.probe();
  expect(result.status).toBe('ready');
  expect(apiKeyEnvironment).toHaveBeenNthCalledWith(1, 'grok', 'XAI_API_KEY');
  expect(apiKeyEnvironment).toHaveBeenNthCalledWith(2, 'grok', 'XAI_API_KEY');
  expect(JSON.stringify(result)).not.toContain('dummy-saved-key');
});

it('publishes credential-read failures as an unavailable backend', async () => {
  vi.mocked(apiKeyEnvironment).mockRejectedValue(new BackendError('auth', 'OSの資格情報ストアを利用できない'));
  const [backend] = await new BackendRegistry([grokAdapter]).describe();
  expect(backend?.status).toBe('unavailable');
  expect(backend?.statusMessage).toContain('資格情報ストア');
});

it('reports a missing CLI independently from credentials', async () => {
  vi.mocked(findCodex).mockReturnValue(null);
  expect(await grokAdapter.probe()).toMatchObject({ status: 'unavailable' });
  expect(apiKeyEnvironment).not.toHaveBeenCalled();
});
