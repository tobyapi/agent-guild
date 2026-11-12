import { apiKeyEnvironment } from '../credentials/store.ts';
vi.mock('../credentials/store.ts', () => ({
  apiKeyEnvironment: vi.fn((_backend: string, _envVar: string, env = process.env) => Promise.resolve(env)),
}));
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runContext, runRequest } from './run.test-support.ts';
import { join } from 'node:path';
import { SECRET_ENV_GLOBS } from './agent-env.ts';

const mock = vi.hoisted(() => ({
  construct: vi.fn(),
  start: vi.fn(),
  stream: vi.fn(),
  skills: vi.fn(),
  mkdir: vi.fn(),
}));
vi.mock('@openai/codex-sdk', () => ({
  Codex: class {
    constructor(options: unknown) {
      mock.construct(options);
    }
    startThread(options: unknown) {
      mock.start(options);
      return { runStreamed: mock.stream };
    }
  },
}));
vi.mock('./codex-runtime/executable.ts', () => ({
  findCodex: () => ({ path: '/bin/codex', pathDirs: [] }),
  CODEX_NOT_FOUND: 'missing',
}));
vi.mock('./skill-files.ts', () => ({ writeSkills: mock.skills }));
vi.mock('node:fs/promises', () => ({ mkdir: mock.mkdir }));
import { grokAdapter } from './grok.ts';

const request = () => runRequest('grok');
const context = runContext;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('XAI_API_KEY', 'test-secret');
  mock.stream.mockImplementation(() =>
    Promise.resolve({
      events: (async function* () {
        await Promise.resolve();
        yield { type: 'item.completed', item: { type: 'agent_message', id: '1', text: 'hello back' } };
      })(),
    }),
  );
});
afterEach(() => vi.unstubAllEnvs());

describe('Grok execution via Codex', () => {
  it('returns conversation text and preserves sandbox, network and secret filtering', async () => {
    const ctx = context();
    await expect(grokAdapter.run(request(), ctx)).resolves.toBe('hello back');
    expect(mock.construct.mock.calls[0]?.[0]).toMatchObject({
      config: {
        model_provider: 'guild_xai',
        project_doc_max_bytes: 0,
        sandbox_workspace_write: { exclude_tmpdir_env_var: true, exclude_slash_tmp: true },
      },
    });
    expect(mock.construct.mock.calls[0]?.[0]).toHaveProperty('config.shell_environment_policy.exclude', [
      ...SECRET_ENV_GLOBS,
    ]);
    expect(mock.construct.mock.calls[0]?.[0]).toHaveProperty('env.XAI_API_KEY', 'test-secret');
    expect(mock.construct.mock.calls[0]?.[0]).toHaveProperty('env.CODEX_HOME', join('/state', 'codex'));
    expect(mock.start).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'grok-4.7',
        modelReasoningEffort: 'high',
        sandboxMode: 'workspace-write',
        approvalPolicy: 'never',
        networkAccessEnabled: false,
        webSearchMode: 'disabled',
      }),
    );
    expect(mock.stream).toHaveBeenCalledWith('hello', { signal: ctx.signal });
  });

  it('passes the selected model and effort per run', async () => {
    await grokAdapter.run({ ...request(), model: 'grok-custom', options: { effort: 'low' } }, context());
    expect(mock.start).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'grok-custom', modelReasoningEffort: 'low' }),
    );
  });

  it('rejects permissions that cannot be enforced before starting the SDK', async () => {
    const req = request();
    req.permissions.readFiles = false;
    await expect(grokAdapter.run(req, context())).rejects.toMatchObject({ code: 'unsupported_permission' });
    expect(mock.construct).not.toHaveBeenCalled();
  });

  it('rejects unsupported Web search and effort', async () => {
    const req = request();
    req.permissions.webSearch = true;
    await expect(grokAdapter.run(req, context())).rejects.toMatchObject({ code: 'unsupported_permission' });
    await expect(grokAdapter.run({ ...request(), options: { effort: 'max' } }, context())).rejects.toMatchObject({
      code: 'bad_request',
    });
  });

  it('reports missing credentials without starting the SDK', async () => {
    vi.stubEnv('XAI_API_KEY', '');
    expect(await grokAdapter.probe()).toMatchObject({ status: 'needs_auth' });
    await expect(grokAdapter.run(request(), context())).rejects.toMatchObject({ code: 'auth' });
    expect(mock.construct).not.toHaveBeenCalled();
  });

  it('explains that ready only checks local prerequisites', async () => {
    expect(await grokAdapter.probe()).toEqual({
      status: 'ready',
      statusMessage: '実験対応・実API未検証。readyはAPIキーとCLIの存在確認のみで、接続成功を意味しない。',
    });
  });

  it('does not start a cancelled run', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(grokAdapter.run(request(), context(controller.signal))).rejects.toThrow();
    expect(mock.construct).not.toHaveBeenCalled();
  });

  it('propagates cancellation from an active SDK stream', async () => {
    const controller = new AbortController();
    mock.stream.mockImplementation((_input: unknown, { signal }: { signal: AbortSignal }) => {
      controller.abort();
      signal.throwIfAborted();
    });
    await expect(grokAdapter.run(request(), context(controller.signal))).rejects.toHaveProperty('name', 'AbortError');
  });

  it('classifies SDK failures and redacts their details', async () => {
    mock.stream.mockRejectedValue(new Error('401 unauthorized test-secret'));
    await expect(grokAdapter.run(request(), context())).rejects.toMatchObject({ code: 'auth' });
    try {
      await grokAdapter.run(request(), context());
    } catch (error) {
      expect(String(error)).not.toContain('test-secret');
    }
  });
});

it('reloads the saved key for every SDK instance and filters the other backend key', async () => {
  vi.mocked(apiKeyEnvironment).mockResolvedValueOnce({
    ...process.env,
    XAI_API_KEY: 'saved-first',
    MODEL_API_KEY: 'other-private',
  });
  await grokAdapter.run(request(), context());
  vi.mocked(apiKeyEnvironment).mockResolvedValueOnce({
    ...process.env,
    XAI_API_KEY: 'saved-replacement',
    MODEL_API_KEY: 'other-private',
  });
  await grokAdapter.run(request(), context());
  await grokAdapter.run(request(), context());
  const environments = mock.construct.mock.calls.map((call) => (call[0] as { env: Record<string, string> }).env);
  expect(environments.map((env) => env.XAI_API_KEY)).toEqual(['saved-first', 'saved-replacement', 'test-secret']);
  for (const env of environments) expect(env).not.toHaveProperty('MODEL_API_KEY');
});
