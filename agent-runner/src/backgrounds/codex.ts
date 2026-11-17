import { Codex } from '@openai/codex-sdk';
import { execFile } from 'node:child_process';
import { lstat, mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { backendAuthMode, codexAuthEnvironment } from '../backends/auth-mode.ts';
import { findCodex } from '../backends/codex-runtime/executable.ts';
import { prepareCommandSandbox } from '../backends/command-sandbox.ts';
import { withPathDirs } from '../backends/executables.ts';
import { SECRET_ENV_GLOBS } from '../backends/agent-env.ts';
import { BackendError } from '../backends/types.ts';

const exec = promisify(execFile);
const LIMIT = 5 * 1024 * 1024;

/** CLI support is checked without generating an image or spending a generation credit. */
export async function codexBackgroundReady(): Promise<boolean> {
  const executable = findCodex();
  if (!executable || backendAuthMode('codex') !== 'desktop') return false;
  try {
    const { stdout } = await exec(executable.path, ['features', 'list'], {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 128 * 1024,
    });
    return /^image_generation\s/m.test(stdout);
  } catch {
    return false;
  }
}

/** A fresh SDK thread draws into a disposable background-only workspace. No frame helpers or skills. */
export async function codexBackground(prompt: string, signal: AbortSignal): Promise<Uint8Array> {
  const executable = findCodex();
  if (!executable || !(await codexBackgroundReady()))
    throw new BackendError('bad_request', 'Background renderer is unavailable');
  if (process.platform === 'win32' && !(await prepareCommandSandbox()))
    throw new BackendError('unsupported_permission', 'Background renderer needs the Windows sandbox');
  signal.throwIfAborted();
  const workspace = await mkdtemp(join(tmpdir(), 'guild-background-'));
  try {
    const env = await codexAuthEnvironment(process.env);
    const codex = new Codex({
      codexPathOverride: executable.path,
      env: withPathDirs(executable.pathDirs, env) ?? env,
      config: {
        features: { image_generation: true },
        project_doc_max_bytes: 0,
        developer_instructions:
          'Create only the requested chat background. Do not read unrelated files, use skills, contact MCP services, or delegate. Use the built-in image generation tool. Save the final image in the working directory as background.png. If the tool saves it elsewhere, copy only that generated image to background.png.',
        sandbox_workspace_write: { exclude_tmpdir_env_var: true, exclude_slash_tmp: true },
        shell_environment_policy: { exclude: [...SECRET_ENV_GLOBS] },
        ...(process.platform === 'win32' ? { windows: { sandbox: 'mxc' } } : {}),
      },
    });
    const thread = codex.startThread({
      workingDirectory: workspace,
      skipGitRepoCheck: true,
      sandboxMode: 'workspace-write',
      approvalPolicy: 'never',
      webSearchMode: 'disabled',
      networkAccessEnabled: false,
    });
    await thread.run(prompt, { signal });
    signal.throwIfAborted();
    return await readCandidate(join(workspace, 'background.png'));
  } finally {
    await rm(workspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

async function readCandidate(path: string): Promise<Uint8Array> {
  const original = await lstat(path);
  if (!original.isFile() || original.isSymbolicLink())
    throw new BackendError('invalid_response', 'Background must be a regular file');
  const file = await open(path, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.ino !== original.ino || stat.dev !== original.dev || !stat.size || stat.size > LIMIT)
      throw new BackendError('invalid_response', 'Invalid background size');
    const bytes = Buffer.alloc(LIMIT + 1);
    let bytesRead = 0;
    while (bytesRead < bytes.length) {
      const chunk = await file.read(bytes, bytesRead, bytes.length - bytesRead, bytesRead);
      if (!chunk.bytesRead) break;
      bytesRead += chunk.bytesRead;
    }
    if (!bytesRead || bytesRead > LIMIT) throw new BackendError('invalid_response', 'Invalid background size');
    return bytes.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}
