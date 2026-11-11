// シンボリックリンクを通じた作業場所外への書き込みも拒否する。
import { lstat, realpath } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';
import { isInside } from '../types.ts';

/** 新規ファイルは最も近い既存の親を解決する。読み取り不能・循環リンクなどは拒否する。 */
async function resolvedTarget(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const entry = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (entry) throw error; // 壊れたシンボリックリンクを通常の新規ファイルとして扱わない。
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(await resolvedTarget(parent), basename(path));
  }
}

export async function writableInWorkspace(target: string, workspace: string): Promise<boolean> {
  if (!isInside(target, workspace)) return false;
  try {
    return isInside(await resolvedTarget(target), await realpath(workspace));
  } catch {
    return false;
  }
}
