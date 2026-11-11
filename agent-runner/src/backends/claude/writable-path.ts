// シンボリックリンク（Windows のジャンクションを含む）を通じた、許した範囲の外への読み書きを拒否する。
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

/** target が roots のどれかの中にあり、リンクをたどった実体も同じ root の中にあるか */
export async function insideRoots(target: string, roots: readonly string[]): Promise<boolean> {
  const lexical = roots.filter((root) => isInside(target, root));
  if (lexical.length === 0) return false;
  try {
    const actual = await resolvedTarget(target);
    for (const root of lexical) {
      // root がまだ無いとき（実行前に Rust が作るので通常はある）も、既存の親までの実体で比べる
      if (isInside(actual, await resolvedTarget(root))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function writableInWorkspace(target: string, workspace: string): Promise<boolean> {
  return insideRoots(target, [workspace]);
}
