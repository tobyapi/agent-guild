// 利用者の環境に入っている CLI（claude・codex）を探すための共通部品: PATH のフォルダ、ファイルの有無、子に渡す PATH。
// 配布版のアプリは Claude Code も Codex CLI も同梱しないので、アダプタはこれで利用者のものを見つけて使う。

import { statSync } from 'node:fs';
import { delimiter, join } from 'node:path';

/** PATH のフォルダ（空と重複を除き、順番は保つ。Windows の Path も見る） */
export function pathDirs(env: NodeJS.ProcessEnv = process.env): string[] {
  const key = pathKey(env);
  const value = key === undefined ? '' : (env[key] ?? '');
  return [
    ...new Set(
      value
        .split(delimiter)
        .map((dir) => dir.trim())
        .filter((dir) => dir !== ''),
    ),
  ];
}

/** ファイルとして存在するか（シンボリックリンクはたどる） */
export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** フォルダとして存在するか */
export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** 環境変数で指定された実行ファイル: 指定がなければ undefined、指定されたファイルがなければ null */
export function overridePath(value: string | undefined): string | null | undefined {
  const path = value?.trim();
  if (!path) return undefined;
  return isFile(path) ? path : null;
}

/** dirs の順に names のどれかがあれば、最初に見つかったもの（フォルダの順を優先する） */
export function findInDirs(dirs: readonly string[], names: readonly string[]): string | null {
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = join(dir, name);
      if (isFile(candidate)) return candidate;
    }
  }
  return null;
}

/** PATH の先頭に dirs を足した環境変数（dirs が空なら undefined = 親の環境をそのまま使う） */
export function withPathDirs(
  dirs: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> | undefined {
  if (dirs.length === 0) return undefined;
  const copied: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined) copied[name] = value;
  }
  const key = pathKey(env) ?? 'PATH';
  copied[key] = [...dirs, copied[key] ?? ''].filter((part) => part !== '').join(delimiter);
  return copied;
}

/** 環境変数の PATH の名前（Windows では Path のこともある） */
function pathKey(env: NodeJS.ProcessEnv): string | undefined {
  return Object.keys(env).find((name) => name.toUpperCase() === 'PATH');
}
