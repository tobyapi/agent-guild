// 道具に渡されたパスが指す実体と、それが役割の範囲の中にあるかの判定（Seatbelt の有無に関係なく、先に行う）。
import { lstat, realpath } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { isJsonObject } from '../../line-parser.ts';
import { scopedTarget } from '../folder-scope.ts';
import { unsafePathForm } from '../tool-paths.ts';
import { BackendError, isInside, type RunRequest } from '../types.ts';
import { canIsolate } from './sandbox.ts';

/** PC 全体への読み書きは、役割が許していて、OS の隔離で管理領域などを守れるときだけ */
export const anywhere = (request: RunRequest): boolean => request.permissions.writeAnywhere && canIsolate();

export async function fileTarget(request: RunRequest, path: string, write: boolean): Promise<string> {
  if (request.writableDirs !== undefined) return scopedTarget(request, path, write);
  const absolute = resolve(request.workspace, path);
  // 開くだけで外へ接続するネットワークパスなどは、実体を調べる前に断る
  const form = unsafePathForm(absolute, [request.workspace, ...request.readableDirs]);
  if (form !== null) throw new BackendError('unsupported_permission', form);
  let target: string;
  try {
    target = await realpath(absolute);
  } catch (error) {
    if (!write || !isJsonObject(error) || error.code !== 'ENOENT') throw error;
    if (
      await lstat(absolute).then(
        (info) => info.isSymbolicLink(),
        () => false,
      )
    )
      throw new BackendError('unsupported_permission', 'リンク先を確認できません');
    target = resolve(await realpath(dirname(absolute)), basename(absolute));
  }
  if (!anywhere(request)) {
    const roots = await Promise.all(
      (write ? [request.workspace] : [request.workspace, ...request.readableDirs]).map((root) => realpath(root)),
    );
    if (!roots.some((root) => isInside(target, root)))
      throw new BackendError('unsupported_permission', '許可されたフォルダの外です');
  }
  return target;
}
