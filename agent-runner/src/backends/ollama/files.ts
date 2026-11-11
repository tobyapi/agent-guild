import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { BackendError, isInside, type RunRequest } from '../types.ts';

const deny = (): never => {
  throw new BackendError('unsupported_permission', 'このファイル操作は許可されていません');
};
const MAX_FILE_BYTES = 128_000;

function checkScope(request: RunRequest, target: string, write: boolean): void {
  const memory = target === join(request.workspace, 'MEMORY.md');
  const permissions = request.permissions;
  if (!(memory || (write ? permissions.writeFiles : permissions.readFiles))) deny();
  if (isInside(target, request.stateDir) && (write || !request.readableDirs.some((root) => isInside(target, root))))
    deny();
  const anywhere = write ? permissions.writeAnywhere : permissions.readAnywhere || permissions.writeAnywhere;
  const roots = write ? [request.workspace] : [request.workspace, ...request.readableDirs];
  if (!anywhere && !roots.some((root) => isInside(target, root))) deny();
}

// 途中のリンクと、別名のファイルも変更してしまうハードリンクへの書き込みは拒否する。
async function rejectLinks(target: string, write: boolean): Promise<void> {
  let cursor = target;
  while (true) {
    const info = await lstat(cursor).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    });
    if (info?.isSymbolicLink() || (write && info?.isFile() && info.nlink > 1)) deny();
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
}

async function checkedPath(request: RunRequest, path: string, write: boolean): Promise<string> {
  const target = resolve(request.workspace, path);
  checkScope(request, target, write);
  await rejectLinks(target, write);
  return target;
}

export async function fileTool(
  request: RunRequest,
  tool: string,
  path: string,
  content: string,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  const write = tool === 'write_file';
  if (write && Buffer.byteLength(content) > MAX_FILE_BYTES)
    throw new BackendError('bad_request', 'ファイルが大きすぎます');
  const target = await checkedPath(request, path, write);
  if (tool === 'list_files') return (await readdir(target)).slice(0, 1000).join('\n');
  if (write) await mkdir(dirname(target), { recursive: true });
  await checkedPath(request, path, write);
  const flags =
    (write ? constants.O_WRONLY | constants.O_CREAT : constants.O_RDONLY) |
    constants.O_NONBLOCK |
    (constants.O_NOFOLLOW ?? 0);
  const file = await open(target, flags, 0o600);
  try {
    const info = await file.stat();
    if (!info.isFile() || (write && info.nlink > 1)) deny();
    if (write) {
      signal.throwIfAborted();
      await file.truncate(0);
      await file.writeFile(content, { signal });
      return `保存しました: ${target}`;
    }
    const buffer = Buffer.alloc(MAX_FILE_BYTES);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString('utf8') + (info.size > MAX_FILE_BYTES ? '\n（以降省略）' : '');
  } finally {
    await file.close();
  }
}
