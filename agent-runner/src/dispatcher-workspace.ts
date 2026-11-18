import { mkdir, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { BackendError, type RunRequest } from './backends/types.ts';

/** Rust が指定した作業場所と管理領域を、ジョブが受理されてから準備する。 */
export async function prepareRunWorkspace(request: RunRequest, signal: AbortSignal): Promise<void> {
  const workspace = resolve(request.workspace);
  const stateDir = resolve(request.stateDir);
  if (
    !isAbsolute(request.workspace) ||
    !isAbsolute(request.stateDir) ||
    basename(workspace) !== 'work' ||
    stateDir !== join(dirname(workspace), 'state', request.backend)
  ) {
    throw new BackendError('bad_request', '作業場所と管理領域の組み合わせが不正です');
  }
  await mkdir(workspace, { recursive: true });
  signal.throwIfAborted();
  await rm(stateDir, { recursive: true, force: true });
  signal.throwIfAborted();
  await mkdir(stateDir, { recursive: true });
}
