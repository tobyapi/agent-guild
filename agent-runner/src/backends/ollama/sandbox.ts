import { access, mkdir, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { assertFolderScope } from '../folder-scope.ts';
import { commandSandboxReady } from '../command-sandbox.ts';
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
  return `(version 1)\n(deny default)\n(allow process-exec)\n(allow signal (target same-sandbox))\n(allow sysctl-read)\n(allow file-read-metadata)\n(allow file-read* (literal "/"))\n${reads}\n${writes}\n(allow file-read* file-write* (literal "/dev/null"))\n(deny file-write* (subpath ${literal(stateDir)}))\n${protectAncestors}\n${privateMemories}`;
}

/**
 * 道具を動かす準備。isolated なら Seatbelt の中で動かす。そうでなければ、ファイル操作はランナーの中でパスの判定で守るか、
 * container なら Windows の隔離の中で行う（指定フォルダのチャンネル。container-file.ts）
 */
export interface Prepared {
  profile: string;
  workspace: string;
  isolated: boolean;
  container: boolean;
}

/** Seatbelt（macOS）で、ファイル操作・コマンド・PC 全体への書き込みをまとめて閉じ込められるか */
export function canIsolate(platform: NodeJS.Platform = process.platform): boolean {
  return platform === 'darwin';
}

/**
 * コマンドを OS の隔離の中で動かせるか: macOS は Seatbelt、Windows は共通の隔離（command-sandbox.ts。MXC）が
 * 使えると確かめ済みのとき。どちらもなければコマンドを使わない
 */
export function canRunCommands(): boolean {
  return canIsolate() || commandSandboxReady();
}

/**
 * Seatbelt のない OS では、作業場所と追加の読み取りフォルダの中のファイル操作を、パスの判定で守って行う
 * （local-file.ts）。指定フォルダのチャンネルは、リンクの差し替えを OS で止める必要があるので、Windows の隔離が
 * 使えるときだけ、ファイル操作をその中で行う（container-file.ts）。使えなければ実行しない。
 * コマンドも、Windows の隔離が使えるときだけ、その中で動かす（windows-command.ts）。
 */
async function unisolated(request: RunRequest): Promise<Prepared> {
  const folder = request.writableDirs !== undefined;
  if (folder && !commandSandboxReady())
    throw new BackendError(
      'unsupported_permission',
      'フォルダ制限には OS の隔離が必要です（macOS か、隔離が使える Windows 11 で使えます）',
    );
  const workspace = await realpath(request.workspace);
  if (isInside(workspace, resolve(request.stateDir)))
    throw new BackendError('bad_request', '作業場所と管理領域が重なっています');
  return { profile: '', workspace, isolated: false, container: folder };
}

/** 制限を適用できなければ実行しない。フォールバックして通常のシェルを起動しない。 */
export async function sandbox(request: RunRequest): Promise<Prepared> {
  assertFolderScope(request);
  if (!canIsolate()) return unisolated(request);
  await access(SANDBOX);
  await mkdir(request.stateDir, { recursive: true });
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
  const helper = `\n(allow file-read* (literal ${literal(await realpath(process.execPath))}))`;
  return { profile: profile + helper, workspace, isolated: true, container: false };
}
