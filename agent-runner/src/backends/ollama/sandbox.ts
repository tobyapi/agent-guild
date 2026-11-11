import { access, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { assertFolderScope } from '../folder-scope.ts';
import { BackendError, isInside, type RunRequest } from '../types.ts';
const SANDBOX = '/usr/bin/sandbox-exec';
function literal(path: string): string {
  if ([...path].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
    throw new BackendError('bad_request', 'パスに制御文字は使えません');
  return JSON.stringify(path);
}

export function seatbeltProfile(request: RunRequest, workspace: string, readable: string[], stateDir: string): string {
  const roots = [workspace, ...readable];
  const writable = [workspace, ...(request.writableDirs ?? [])];
  const reads = request.permissions.writeAnywhere
    ? '(allow file-read*)'
    : `(allow file-read* ${[...roots, '/System/Library', '/System/iOSSupport/System/Library', '/usr/bin', '/usr/sbin', '/usr/lib', '/usr/libexec', '/usr/share', '/bin', '/sbin', '/private/var/db/dyld'].map((root) => `(subpath ${literal(root)})`).join(' ')})`;
  const writes = !request.permissions.writeFiles
    ? ''
    : request.permissions.writeAnywhere
      ? '(allow file-write*)'
      : `(allow file-write* ${writable.map((root) => `(subpath ${literal(root)})`).join(' ')})`;
  const ancestors: string[] = [];
  for (let parent = dirname(stateDir); parent !== dirname(parent); parent = dirname(parent)) ancestors.push(parent);
  const privateMemories =
    request.writableDirs === undefined
      ? ''
      : readable
          .filter((root) => !writable.includes(root))
          .map((root) => `(deny file-read* (literal ${literal(join(root, 'MEMORY.md'))}))`)
          .join('\n');
  const protectAncestors = ancestors.map((path) => `(deny file-write-unlink (literal ${literal(path)}))`).join('\n');
  return `(version 1)\n(deny default)\n(allow process-exec)\n(allow signal (target same-sandbox))\n(allow sysctl-read)\n(allow file-read-metadata)\n(allow file-read* (literal "/"))\n${reads}\n${writes}\n(allow file-read* file-write* (literal "/dev/null"))\n(deny file-write* (subpath ${literal(stateDir)}))\n${protectAncestors}\n${privateMemories}\n${request.permissions.webFetch && request.permissions.webSearch ? '(allow network*)' : ''}`;
}

/** 制限を適用できなければ実行しない。フォールバックして通常のシェルを起動しない。 */
export async function sandbox(request: RunRequest): Promise<{ profile: string; workspace: string }> {
  assertFolderScope(request);
  if (process.platform !== 'darwin')
    throw new BackendError(
      'unsupported_permission',
      'Ollama のファイル操作とコマンド実行は macOS の Seatbelt が必要です',
    );
  await access(SANDBOX);
  const workspace = await realpath(request.workspace);
  const readable = await Promise.all(request.readableDirs.map((path) => realpath(path)));
  // stateDir は実行準備時点で存在する管理領域。
  const stateDir = await realpath(request.stateDir);
  if (isInside(workspace, stateDir)) throw new BackendError('bad_request', '作業場所と管理領域が重なっています');
  const writableDirs =
    request.writableDirs === undefined
      ? undefined
      : await Promise.all(request.writableDirs.map((path) => realpath(path)));
  const profile = seatbeltProfile({ ...request, writableDirs }, workspace, readable, stateDir);
  const helper =
    request.writableDirs === undefined
      ? ''
      : `\n(allow file-read* (literal ${literal(await realpath(process.execPath))}))`;
  return { profile: profile + helper, workspace };
}
