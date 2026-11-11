// 「名前の一覧だけ」を許した親フォルダの下で、範囲に関係のないフォルダを隠す。
// MXC の一覧の許可（enumeratePaths）は、そのフォルダの下の階層すべてに効く。親フォルダをドライブの直下まで一覧させる
// だけだと、同じドライブにあるフォルダの中の名前が（中身は読めなくても）すべて見えてしまう。そこで、親フォルダの直下に
// あるフォルダのうち、許可した場所へ続かないものを、拒否（deniedPaths）に入れる。残るのは「親フォルダの直下の名前」だけ。
// 確かめたことは docs/command-sandbox.md。

import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isInside } from '../types.ts';

/** 大文字小文字の違いを無視して比べるための形（Windows のパス） */
const key = (path: string): string => resolve(path).toLowerCase();

const envValue = (env: NodeJS.ProcessEnv, name: string): string | undefined =>
  Object.entries(env).find(([entry]) => entry.toUpperCase() === name.toUpperCase())?.[1];

/**
 * 隠さない場所: Windows・Program Files・ProgramData は、隔離の中から最初から見えていて、プログラムが動くのに要る。
 * 利用者ごとのアプリのパッケージ置き場（%LOCALAPPDATA%\Packages）は、隔離が自分の置き場として使うので、拒否すると
 * その親フォルダごと確かめられなくなる（実機で確認）
 */
export function systemDirs(env: NodeJS.ProcessEnv): string[] {
  const dirs = ['SystemRoot', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432', 'ProgramData'].map((name) =>
    envValue(env, name),
  );
  const local = envValue(env, 'LOCALAPPDATA');
  if (local) dirs.push(join(local, 'Packages'));
  return dirs.filter((dir): dir is string => dir !== undefined && dir.trim() !== '').map((dir) => resolve(dir));
}

/**
 * フォルダの直下にある、本物のフォルダ。リンク（ジャンクション）は挙げない: 拒否はリンク先に効くので、
 * 「Documents and Settings」（Users を指す）などを入れると、必要な親フォルダまで拒否してしまう。読めなければ空
 */
export function childDirectories(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dir, entry.name));
  } catch {
    return [];
  }
}

/**
 * parents（名前の一覧だけを許す親フォルダ）の直下にあるフォルダのうち、隠すもの。parents と granted（読み書きを許した
 * 場所）そのもの、システムのフォルダとその中は隠さない。設定を作ったあとにできたフォルダは隠れない
 */
export function hiddenSiblings(
  parents: readonly string[],
  granted: readonly string[],
  env: NodeJS.ProcessEnv,
  list: (dir: string) => string[] = childDirectories,
): string[] {
  const system = systemDirs(env);
  const keep = new Set([...parents, ...granted, ...system].map(key));
  return parents
    .filter((parent) => !system.some((dir) => isInside(parent, dir)))
    .flatMap((parent) => list(parent).filter((child) => !keep.has(key(child))));
}
