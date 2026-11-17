import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  workspace: '',
  fail: false,
  prompt: '',
  options: {},
  config: {},
}));
vi.mock('@openai/codex-sdk', () => ({
  Codex: class {
    constructor(options: { config: Record<string, unknown> }) {
      fake.config = options.config;
    }
    startThread(options: Record<string, unknown>) {
      fake.options = options;
      fake.workspace = String(options.workingDirectory);
      return {
        run: async (prompt: string) => {
          fake.prompt = prompt;
          if (fake.fail) throw new Error('failed');
          await writeFile(join(fake.workspace, 'background.png'), new Uint8Array([1, 2, 3]));
          await mkdir(join(fake.workspace, 'leftovers'));
        },
      };
    }
  },
}));
vi.mock('node:child_process', () => ({
  execFile: (_exe: string, _args: string[], _options: unknown, done: (error: null, result: unknown) => void) =>
    done(null, { stdout: 'image_generation experimental false\n' }),
}));
vi.mock('../backends/codex-runtime/executable.ts', () => ({ findCodex: () => ({ path: 'codex', pathDirs: [] }) }));
vi.mock('../backends/command-sandbox.ts', () => ({ prepareCommandSandbox: () => Promise.resolve(true) }));
vi.mock('../backends/auth-mode.ts', () => ({
  backendAuthMode: () => 'desktop',
  codexAuthEnvironment: () => Promise.resolve({}),
}));
import { codexBackground } from './codex.ts';

afterEach(() => {
  fake.fail = false;
});
it('uses a new background workspace and removes it after reading only its fixed output', async () => {
  const bytes = await codexBackground('landscape', new AbortController().signal);
  expect([...bytes]).toEqual([1, 2, 3]);
  expect(fake.prompt).toBe('landscape');
  expect(fake.options).toMatchObject({
    sandboxMode: 'workspace-write',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
  });
  expect(fake.config).toMatchObject({ features: { image_generation: true }, project_doc_max_bytes: 0 });
  expect(existsSync(fake.workspace)).toBe(false);
});
it('removes its workspace when the SDK fails', async () => {
  fake.fail = true;
  await expect(codexBackground('landscape', new AbortController().signal)).rejects.toThrow('failed');
  expect(existsSync(fake.workspace)).toBe(false);
});
