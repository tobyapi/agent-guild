import { constants, type BigIntStats } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { secretRoots } from '../secret-roots.ts';
import { BackendError, isInside, type RunRequest } from '../types.ts';
import { controls } from './characters.ts';

const denied = () => new BackendError('unsupported_permission', 'Grok read denied by file policy.');
function normalized(path: string): string {
  const value = resolve(path)
    .normalize('NFC')
    .replace(/^\/System\/Volumes\/Data(?=\/)/i, '');
  return process.platform === 'linux' ? value : value.toLowerCase();
}
const inside = (path: string, root: string) => isInside(normalized(path), normalized(root));

function safeForm(path: string): void {
  if (
    !path ||
    path.trim() !== path ||
    controls(path) ||
    /^[\\/]{2}/.test(path) ||
    path.replace(/^[A-Za-z]:/, '').includes(':')
  )
    throw denied();
}

function secretName(path: string): boolean {
  return path
    .split(/[\\/]/)
    .some((part) =>
      /^(?:\.env(?:\..*)?|id_(?:rsa|dsa|ecdsa|ed25519).*|guild\.db(?:[-.].*)?)$|\.(?:pem|key|p12|pfx)$/i.test(
        part.replace(/[. ]+$/, ''),
      ),
    );
}

async function noLinks(path: string): Promise<void> {
  for (let current = path; ; current = dirname(current)) {
    if ((await lstat(current)).isSymbolicLink()) throw denied();
    if (dirname(current) === current) break;
  }
}

async function excluded(path: string, request: RunRequest): Promise<boolean> {
  if (secretName(path)) return true;
  const roots = [request.stateDir, ...secretRoots()];
  for (const root of roots) {
    if (inside(path, root)) return true;
    const actual = await realpath(root).catch(() => root);
    if (inside(path, actual)) return true;
  }
  // All sibling agent state directories belong to the management area.
  const agentRoot = dirname(request.workspace);
  const relative = normalized(path)
    .slice(normalized(dirname(agentRoot)).length)
    .split(sep);
  return inside(path, dirname(agentRoot)) && relative.includes('state');
}

async function approved(request: RunRequest, raw: string): Promise<{ path: string; before: BigIntStats }> {
  if (!request.permissions.readFiles) throw denied();
  safeForm(raw);
  const path = resolve(request.workspace, raw);
  await noLinks(path);
  const before = await lstat(path, { bigint: true });
  if (!before.isFile() || before.nlink !== 1n || (await excluded(path, request))) throw denied();
  const actual = await realpath(path);
  if (normalized(actual) !== normalized(path) || (await excluded(actual, request))) throw denied();
  if (!request.permissions.readAnywhere) {
    const roots = await Promise.all([request.workspace, ...request.readableDirs].map((root) => realpath(root)));
    if (!roots.some((root) => inside(actual, root))) throw denied();
  }
  return { path: actual, before };
}

function singleFile(info: BigIntStats): boolean {
  return info.isFile() && info.nlink === 1n;
}
function sameFile(first: BigIntStats, second: BigIntStats): boolean {
  return first.ino === second.ino && first.dev === second.dev;
}

/** Single-link regular files only. Capture identity before opening; read through that handle. */
export async function readBytes(request: RunRequest, raw: string, signal: AbortSignal, limit = 32768): Promise<Buffer> {
  signal.throwIfAborted();
  const { path, before } = await approved(request, raw);
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat({ bigint: true });
    await noLinks(path);
    const after = await lstat(path, { bigint: true });
    if (
      !singleFile(opened) ||
      !singleFile(after) ||
      !sameFile(opened, before) ||
      !sameFile(opened, after) ||
      normalized(await realpath(path)) !== normalized(path)
    )
      throw denied();
    signal.throwIfAborted();
    const buffer = Buffer.alloc(limit + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    signal.throwIfAborted();
    if (bytesRead > limit) throw new BackendError('bad_request', 'Grok file size limit exceeded.');
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function readLocal(request: RunRequest, raw: string, signal: AbortSignal): Promise<string> {
  return (await readBytes(request, raw, signal)).toString('utf8');
}
