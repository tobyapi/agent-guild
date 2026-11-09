import { apiKeyEnvironment } from '../credentials/store.ts';
vi.mock('../credentials/store.ts', () => ({ apiKeyEnvironment: vi.fn((_backend: string, env = process.env) => Promise.resolve(env)) }));
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunContext, RunRequest } from './types.ts';
import { join } from 'node:path';
import { SECRET_ENV_GLOBS } from './agent-env.ts';

const mock = vi.hoisted(() => ({ construct: vi.fn(), start: vi.fn(), stream: vi.fn(), skills: vi.fn(), mkdir: vi.fn() }));
vi.mock('@openai/codex-sdk', () => ({ Codex: class {
  constructor(options: unknown) { mock.construct(options); }
  startThread(options: unknown) { mock.start(options); return { runStreamed: mock.stream }; }
} }));
vi.mock('./codex-runtime/executable.ts', () => ({ findCodex: () => ({ path: '/bin/codex', pathDirs: [] }), CODEX_NOT_FOUND: 'missing' }));
vi.mock('./skill-files.ts', () => ({ writeSkills: mock.skills }));
vi.mock('node:fs/promises', () => ({ mkdir: mock.mkdir }));
import { museAdapter, museProvider } from './muse.ts';
import { runCodex } from './codex-runtime.ts';

const request = (): RunRequest => ({
  type: 'run', id: 'j', backend: 'muse', workspace: '/work', stateDir: '/state', readableDirs: [],
  model: '', prompt: 'hello', systemPrompt: 'system', intent: '', options: {}, skills: [], images: [],
  permissions: { webSearch: false, webFetch: false, readFiles: true, writeFiles: true, writeAnywhere: false, runCommands: true, skills: true },
});
const context = (signal = new AbortController().signal): RunContext => ({ signal, onActivity: vi.fn(), onPost: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MODEL_API_KEY', 'test-secret');
  mock.stream.mockImplementation(() => Promise.resolve({ events: (async function* () {
    await Promise.resolve();
    yield { type: 'item.completed', item: { type: 'agent_message', id: '1', text: 'hello back' } };
  })() }));
});
afterEach(() => vi.unstubAllEnvs());

describe('Muse Spark execution via Codex', () => {
  it('keeps shared permission settings when provider config conflicts', async () => {
    const provider = museProvider('/state');
    Object.assign(provider.config, {
      developer_instructions: 'provider override', project_doc_max_bytes: 100_000,
      sandbox_workspace_write: { exclude_tmpdir_env_var: false, exclude_slash_tmp: false },
      shell_environment_policy: { exclude: [] },
    });
    await runCodex(request(), context(), provider);
    expect(mock.construct.mock.calls[0]?.[0]).toMatchObject({ config: {
      model_provider: 'guild_meta', developer_instructions: 'system', project_doc_max_bytes: 0,
      sandbox_workspace_write: { exclude_tmpdir_env_var: true, exclude_slash_tmp: true },
      shell_environment_policy: { exclude: [...SECRET_ENV_GLOBS] },
    } });
  });

  it('returns conversation text and preserves sandbox, network and secret filtering', async () => {
    const ctx = context();
    await expect(museAdapter.run(request(), ctx)).resolves.toBe('hello back');
    expect(mock.construct.mock.calls[0]?.[0]).toMatchObject({ config: {
      model_provider: 'guild_meta', project_doc_max_bytes: 0,
      sandbox_workspace_write: { exclude_tmpdir_env_var: true, exclude_slash_tmp: true },
    } });
    expect(mock.construct.mock.calls[0]?.[0]).toHaveProperty('config.shell_environment_policy.exclude', [...SECRET_ENV_GLOBS]);
    expect(mock.construct.mock.calls[0]?.[0]).toHaveProperty('env.MODEL_API_KEY', 'test-secret');
    expect(mock.construct.mock.calls[0]?.[0]).toHaveProperty('env.CODEX_HOME', join('/state', 'muse-codex'));
    expect(mock.start).toHaveBeenCalledWith(expect.objectContaining({ model: 'muse-spark-1.3', modelReasoningEffort: 'high',
      sandboxMode: 'workspace-write', approvalPolicy: 'never', networkAccessEnabled: false, webSearchMode: 'disabled' }));
    expect(mock.stream).toHaveBeenCalledWith('hello', { signal: ctx.signal });
  });

  it('passes the selected model and effort per run', async () => {
    await museAdapter.run({ ...request(), model: 'muse-spark-1.3', options: { effort: 'max' } }, context());
    expect(mock.start).toHaveBeenCalledWith(expect.objectContaining({ model: 'muse-spark-1.3', modelReasoningEffort: 'max' }));
  });

  it.each(['muse-spark-1.3-contributor', 'muse-wonder-1.0', 'unknown'])('rejects unlisted model %s before execution', async (model) => {
    await expect(museAdapter.run({ ...request(), model }, context())).rejects.toMatchObject({ code: 'model_not_found' });
    expect(mock.construct).not.toHaveBeenCalled();
  });

  it('constructs independent provider state and credentials for each run', async () => {
    await museAdapter.run(request(), context());
    vi.stubEnv('MODEL_API_KEY', 'second-secret');
    await museAdapter.run({ ...request(), stateDir: '/second' }, context());
    expect(mock.construct).toHaveBeenCalledTimes(2);
    expect(mock.construct.mock.calls[0]?.[0]).toHaveProperty('env.MODEL_API_KEY', 'test-secret');
    expect(mock.construct.mock.calls[1]?.[0]).toHaveProperty('env.MODEL_API_KEY', 'second-secret');
    expect(mock.construct.mock.calls[1]?.[0]).toHaveProperty('env.CODEX_HOME', join('/second', 'muse-codex'));
  });

  it('rejects permissions that cannot be enforced before starting the SDK', async () => {
    const req = request();
    req.permissions.readFiles = false;
    await expect(museAdapter.run(req, context())).rejects.toMatchObject({ code: 'unsupported_permission' });
    expect(mock.construct).not.toHaveBeenCalled();
  });

  it('rejects unsupported Web search and effort', async () => {
    const req = request();
    req.permissions.webSearch = true;
    await expect(museAdapter.run(req, context())).rejects.toMatchObject({ code: 'unsupported_permission' });
    await expect(museAdapter.run({ ...request(), options: { effort: 'ultra' } }, context())).rejects.toMatchObject({ code: 'bad_request' });
  });

  it('reports missing credentials without starting the SDK', async () => {
    vi.stubEnv('MODEL_API_KEY', '');
    expect(await museAdapter.probe()).toMatchObject({ status: 'needs_auth' });
    await expect(museAdapter.run(request(), context())).rejects.toMatchObject({ code: 'auth' });
    expect(mock.construct).not.toHaveBeenCalled();
  });

  it('does not start a cancelled run', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(museAdapter.run(request(), context(controller.signal))).rejects.toThrow();
    expect(mock.construct).not.toHaveBeenCalled();
  });

  it('propagates cancellation from an active SDK stream', async () => {
    const controller = new AbortController();
    mock.stream.mockImplementation((_input: unknown, { signal }: { signal: AbortSignal }) => {
      controller.abort();
      signal.throwIfAborted();
    });
    await expect(museAdapter.run(request(), context(controller.signal))).rejects.toHaveProperty('name', 'AbortError');
  });

  it('classifies SDK failures and redacts their details', async () => {
    mock.stream.mockRejectedValue(new Error('401 unauthorized test-secret'));
    await expect(museAdapter.run(request(), context())).rejects.toMatchObject({ code: 'auth' });
    try { await museAdapter.run(request(), context()); } catch (error) {
      expect(String(error)).not.toContain('test-secret');
    }
  });
});

it('reloads the saved key for every SDK instance and filters the other backend key', async () => {
  vi.mocked(apiKeyEnvironment).mockResolvedValueOnce({ ...process.env, MODEL_API_KEY: 'saved-first', XAI_API_KEY: 'other-private' });
  await museAdapter.run(request(), context());
  vi.mocked(apiKeyEnvironment).mockResolvedValueOnce({ ...process.env, MODEL_API_KEY: 'saved-replacement', XAI_API_KEY: 'other-private' });
  await museAdapter.run(request(), context());
  await museAdapter.run(request(), context());
  const environments = mock.construct.mock.calls.map((call) => (call[0] as { env: Record<string, string> }).env);
  expect(environments.map((env) => env.MODEL_API_KEY)).toEqual(['saved-first', 'saved-replacement', 'test-secret']);
  for (const env of environments) expect(env).not.toHaveProperty('XAI_API_KEY');
});
