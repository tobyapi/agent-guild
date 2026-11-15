import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runContext, runRequest } from '../run.test-support.ts';
import type { CodexOptions } from '@openai/codex-sdk';

const mock = vi.hoisted(() => ({
  prepare: vi.fn(),
  construct: vi.fn<(options: CodexOptions) => void>(),
  skills: vi.fn(),
  start: vi.fn(),
}));
vi.mock('../command-sandbox.ts', () => ({ prepareCommandSandbox: mock.prepare }));
vi.mock('../auth-mode.ts', () => ({ codexAuthEnvironment: (env: unknown) => Promise.resolve(env) }));
vi.mock('./executable.ts', () => ({
  findCodex: () => ({ path: 'codex', pathDirs: [] }),
  codexNotFound: () => 'missing',
}));
vi.mock('./skills.ts', () => ({ installCodexSkills: mock.skills }));
vi.mock('@openai/codex-sdk', () => ({
  Codex: class {
    constructor(options: CodexOptions) {
      mock.construct(options);
    }
    startThread(options: unknown) {
      mock.start(options);
      return {
        runStreamed: () => ({ events: [] }),
      };
    }
  },
}));
import { runCodex, type CodexProvider } from '../codex-runtime.ts';

const provider: CodexProvider = {
  label: 'fixture',
  config: { windows: { sandbox: 'unelevated' } },
  env: {},
  catalog: { models: [], defaultModel: '' },
  failure: (detail) => new Error(detail) as ReturnType<CodexProvider['failure']>,
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.prepare.mockResolvedValue(true);
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
});
afterEach(() => vi.restoreAllMocks());

describe('Codex Windows sandbox startup', () => {
  it('uses the common capability probe and overrides provider selection with MXC', async () => {
    await runCodex(runRequest('codex'), runContext(), provider);
    expect(mock.prepare).toHaveBeenCalledOnce();
    expect(mock.construct.mock.calls[0]?.[0].config).toHaveProperty('windows.sandbox', 'mxc');
    expect(mock.start).toHaveBeenCalledWith(
      expect.objectContaining({ sandboxMode: 'workspace-write', approvalPolicy: 'never', networkAccessEnabled: false }),
    );
  });

  it('fails closed before SDK startup or workspace changes when MXC is unavailable', async () => {
    mock.prepare.mockResolvedValue(false);
    await expect(runCodex(runRequest('codex'), runContext(), provider)).rejects.toMatchObject({
      code: 'unsupported_permission',
    });
    expect(mock.construct).not.toHaveBeenCalled();
    expect(mock.skills).not.toHaveBeenCalled();
  });

  it.each(['linux', 'darwin'] as const)('keeps native sandbox behavior on %s', async (platform) => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue(platform);
    await runCodex(runRequest('codex'), runContext(), { ...provider, config: {} });
    expect(mock.prepare).not.toHaveBeenCalled();
    expect(mock.construct.mock.calls[0]?.[0].config).not.toHaveProperty('windows');
    expect(mock.start).toHaveBeenCalledWith(
      expect.objectContaining({ sandboxMode: 'workspace-write', approvalPolicy: 'never' }),
    );
  });
});
