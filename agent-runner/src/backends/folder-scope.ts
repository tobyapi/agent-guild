// 指定フォルダのチャンネル（依頼に writableDirs が付く）の範囲の確認。どのバックエンドがどう守るかは、アダプタの申告
// （BackendInfo.folderScope）で決まる。ここにはバックエンドの ID による分岐を置かない。
import { lstat, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { t } from '../texts/index.ts';
import { BackendError, isInside, type BackendDescriptor, type RunRequest } from './types.ts';

/**
 * 指定フォルダの依頼を、申告された守り方で受けられるか確かめる（Dispatcher が実行の前に呼ぶ）。守り方を申告していない
 * バックエンドには渡さない（指定フォルダの依頼を、黙って範囲の外で動かさない）
 */
export function assertBackendFolderScope(info: BackendDescriptor, request: RunRequest): void {
  if (request.writableDirs === undefined) return;
  if (info.folderScope === null) {
    throw new BackendError('unsupported_permission', t('folderUnsupported', { backend: info.label }));
  }
  if (info.folderScope === 'files') assertFolderScope(request);
  else assertSandboxedFolderScope(request);
}

/**
 * ファイルの道具ごとにパスを確かめて範囲を守るバックエンド（folderScope: 'files'）の、指定フォルダの依頼の確認。
 * コマンドとスキルは確認をすり抜けるので、PC 全体の読み書きと合わせて両立しない
 */
export function assertFolderScope(request: RunRequest): void {
  if (request.writableDirs === undefined) return;
  if (
    request.permissions.readAnywhere ||
    request.permissions.writeAnywhere ||
    request.permissions.skills ||
    request.permissions.runCommands
  )
    throw new BackendError('unsupported_permission', t('folderPermissions'));
  if (![request.workspace, ...request.readableDirs, ...request.writableDirs].every(isAbsolute))
    throw new BackendError('bad_request', t('folderAbsolute'));
}

/**
 * シェルごと OS の隔離に入れて範囲を守るバックエンド（folderScope: 'sandbox'）の、指定フォルダの依頼の確認。道具ごとの
 * パスの判定はしないので、コマンドは使ってよい。PC 全体の読み書きとは両立しない
 */
export function assertSandboxedFolderScope(request: RunRequest): void {
  if (request.writableDirs === undefined) return;
  if (request.permissions.readAnywhere || request.permissions.writeAnywhere)
    throw new BackendError('unsupported_permission', t('folderPermissions'));
  if (![request.workspace, ...request.readableDirs, ...request.writableDirs].every(isAbsolute))
    throw new BackendError('bad_request', t('folderAbsolute'));
}

/** まだないファイルは、いちばん近い既存の親まで実体を解決する。壊れたリンクは受け付けない */
async function physical(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || dirname(path) === path) throw error;
    const entry = await lstat(path).catch((failure: NodeJS.ErrnoException) => {
      if (failure.code === 'ENOENT') return null;
      throw failure;
    });
    if (entry) throw error;
    return join(await physical(dirname(path)), basename(path));
  }
}

/**
 * 指定フォルダの範囲の中のパスなら、その実体のパスを返す（外・相談相手のメモ・特殊ファイル・ハードリンクは BackendError）。
 * write は書き込み先として確かめる
 */
export async function scopedTarget(request: RunRequest, path: string, write: boolean): Promise<string> {
  const lexical = resolve(request.workspace, path);
  const roots = [request.workspace, ...(write ? (request.writableDirs ?? []) : request.readableDirs)];
  const actual = await physical(lexical);
  const approved = await Promise.all(
    roots.map(async (root) => isInside(lexical, root) && isInside(actual, await realpath(root))),
  );
  if (!approved.some(Boolean)) throw new BackendError('unsupported_permission', 'チャンネルの作業範囲外です');
  // 相談で読めるのは成果物だけで、相談相手のメモ（MEMORY.md）は読ませない
  const writable = [request.workspace, ...(request.writableDirs ?? [])];
  for (const root of request.readableDirs) {
    if (!writable.includes(root) && actual === join(await realpath(root), 'MEMORY.md'))
      throw new BackendError('unsupported_permission', '相談相手のMEMORY.mdは共有されません');
  }
  await ordinaryFile(actual, write);
  return actual;
}

async function ordinaryFile(actual: string, write: boolean): Promise<void> {
  const info = await lstat(actual).catch((error: NodeJS.ErrnoException) => {
    if (write && error.code === 'ENOENT') return null;
    throw error;
  });
  if (info && ((!info.isFile() && !info.isDirectory()) || (info.isFile() && info.nlink > 1)))
    throw new BackendError('unsupported_permission', '特殊ファイルやハードリンクは扱えません');
}
