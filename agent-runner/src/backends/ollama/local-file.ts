// Seatbelt のない OS（Windows・Linux）でのファイル道具。scoped-file.ts（Seatbelt の中で動かす固定のコード）と同じ確認を、
// ランナーのプロセスの中で行う: 開いたファイルが、パスで判定した実体そのもの（同じファイルで、リンクは1本）であることを
// 確かめてから読み書きする。OS の隔離がないぶん、確認から操作までの間の差し替えは止められない
// （Claude のファイル道具と同じ強さ。そのため指定フォルダ・コマンド・作業フォルダの外への書き込みはこの方式では扱わない）。

import { constants, type BigIntStats } from 'node:fs';
import { lstat, open, readdir, realpath, type FileHandle } from 'node:fs/promises';
import { relative } from 'node:path';
import { BackendError, isInside } from '../types.ts';

export interface LocalFileOperation {
  /** リンクを解決済みの絶対パス（新しく作るファイルは、解決済みの親フォルダ＋名前） */
  path: string;
  /** この操作に許す範囲（リンクを解決済みの絶対パス） */
  roots: readonly string[];
  mode: 'read_file' | 'list_files' | 'write_file';
  content?: string;
  /** 読み取り・一覧の出力の上限（バイト） */
  limit: number;
}

/** リンクをたどらずに開く（Windows にはこの指定がないので、開いたあとの実体の確認で代える） */
const NOFOLLOW = constants.O_NOFOLLOW ?? 0;

const denied = (message: string): BackendError => new BackendError('unsupported_permission', message);
const tooLarge = (): BackendError => new BackendError('bad_request', '道具の出力が32KiBを超えました');

/** いまもパスの実体がそのパス自身で、許した範囲の中にあること（判定のあとにリンクへ差し替えられていないこと） */
async function approved({ path, roots }: LocalFileOperation): Promise<BigIntStats> {
  const actual = await realpath(path);
  if (relative(actual, path) !== '' || !roots.some((root) => isInside(actual, root))) {
    throw denied('作業範囲またはパスの実体が変わりました');
  }
  return lstat(path, { bigint: true });
}

/** 開いたものが、通常のファイルで、ほかの名前（ハードリンク）を持たず、パスが指すファイルと同じであること */
async function assertSameFile(handle: FileHandle, operation: LocalFileOperation): Promise<void> {
  const opened = await handle.stat({ bigint: true });
  const checked = await approved(operation);
  const same = opened.ino === checked.ino && opened.dev === checked.dev;
  if (!opened.isFile() || opened.nlink !== 1n || checked.nlink !== 1n || !same) {
    throw denied('特殊ファイル・ハードリンク・差し替えられたファイルは扱えません');
  }
}

async function listFiles(operation: LocalFileOperation): Promise<string> {
  const before = await approved(operation);
  if (!before.isDirectory()) throw new BackendError('bad_request', 'フォルダを指定してください');
  const entries = await readdir(operation.path);
  const after = await approved(operation);
  if (before.ino !== after.ino || before.dev !== after.dev) throw denied('フォルダの実体が変わりました');
  const result = entries.join('\n');
  if (Buffer.byteLength(result) > operation.limit) throw tooLarge();
  return result;
}

/** リンクをたどらずに開く。リンクに差し替えられていたら、O_NOFOLLOW のある OS では ELOOP になるので、拒否として返す */
async function openNoFollow(path: string, flags: number, mode?: number): Promise<FileHandle> {
  try {
    return await open(path, flags | NOFOLLOW, mode);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
      throw denied('特殊ファイル・ハードリンク・差し替えられたファイルは扱えません');
    }
    throw error;
  }
}

async function readFile(operation: LocalFileOperation): Promise<string> {
  const handle = await openNoFollow(operation.path, constants.O_RDONLY);
  try {
    await assertSameFile(handle, operation);
    const buffer = Buffer.alloc(operation.limit + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > operation.limit) throw tooLarge();
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await handle.close();
  }
}

/** 新しいファイルは「無ければ作る」で開き、既にあれば切り詰めずに開く（中身を消すのは、同じファイルだと確かめたあと） */
async function openForWrite(path: string): Promise<FileHandle> {
  try {
    return await openNoFollow(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    return openNoFollow(path, constants.O_WRONLY);
  }
}

async function writeFile(operation: LocalFileOperation): Promise<string> {
  const handle = await openForWrite(operation.path);
  try {
    await assertSameFile(handle, operation);
    await handle.truncate(0);
    await handle.writeFile(operation.content ?? '', 'utf8');
    return 'written';
  } finally {
    await handle.close();
  }
}

/** 範囲とパスの形を確かめたあとの、実際の読み書き・一覧（結果は Seatbelt 版と同じ文字列） */
export function localFile(operation: LocalFileOperation): Promise<string> {
  if (operation.mode === 'list_files') return listFiles(operation);
  return operation.mode === 'write_file' ? writeFile(operation) : readFile(operation);
}
