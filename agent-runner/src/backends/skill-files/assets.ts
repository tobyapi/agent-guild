// ライブラリにリンクしたスキル（SkillPayload.dir）の付属ファイル（scripts/・references/ など）を、
// 元のフォルダから展開先へコピーする。コピーしないもの: SKILL.md 自身（payload から書く）・.git・node_modules・
// シンボリックリンク。上限は1回の展開の合計で 50MB・2000 ファイル（超えたら bad_request）。

import type { Dirent } from 'node:fs';
import { copyFile, lstat, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { BackendError, isInside } from '../types.ts';

export interface AssetLimits {
  maxFiles: number;
  maxBytes: number;
}

export const ASSET_LIMITS: AssetLimits = { maxFiles: 2000, maxBytes: 50 * 1024 * 1024 };

const SKIPPED_NAMES = new Set(['.git', 'node_modules']);

/** 1つのスキルについてコピーするファイル（元のフォルダからの相対パス） */
export interface AssetPlan {
  sourceDir: string;
  files: string[];
}

/** 1回の展開で全スキルが共有する残りの枠 */
export class AssetBudget {
  readonly #limits: AssetLimits;
  #files = 0;
  #bytes = 0;

  constructor(limits: AssetLimits = ASSET_LIMITS) {
    this.#limits = limits;
  }

  take(skillName: string, bytes: number): void {
    this.#files += 1;
    this.#bytes += bytes;
    if (this.#files <= this.#limits.maxFiles && this.#bytes <= this.#limits.maxBytes) return;
    const megabytes = Math.floor(this.#limits.maxBytes / (1024 * 1024));
    throw new BackendError(
      'bad_request',
      `スキル ${skillName} で付属ファイルが上限（合計 ${megabytes}MB・${this.#limits.maxFiles} ファイル）を超えました`,
    );
  }
}

function isSkipped(entry: Dirent, relativeDir: string): boolean {
  if (entry.isSymbolicLink() || SKIPPED_NAMES.has(entry.name)) return true;
  // SKILL.md は payload から書く（大文字小文字だけ違う名前も Windows では同じファイルになるので除く）
  return relativeDir === '' && entry.name.toLowerCase() === 'skill.md';
}

async function assertDirectory(sourceDir: string, skillName: string): Promise<void> {
  const info = isAbsolute(sourceDir) ? await stat(sourceDir).catch(() => null) : null;
  if (!info?.isDirectory()) {
    throw new BackendError('bad_request', `スキル ${skillName} のフォルダを読めません（絶対パスのフォルダが必要です）: ${sourceDir}`);
  }
}

/** 元のフォルダを走査してコピーするファイルを数える（まだ書かない）。枠を超えたら bad_request */
export async function planAssets(sourceDir: string, skillName: string, budget: AssetBudget): Promise<AssetPlan> {
  await assertDirectory(sourceDir, skillName);
  const files: string[] = [];
  const pending = [''];
  for (let relativeDir = pending.pop(); relativeDir !== undefined; relativeDir = pending.pop()) {
    for (const entry of await readdir(join(sourceDir, relativeDir), { withFileTypes: true })) {
      if (isSkipped(entry, relativeDir)) continue;
      const relative = join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        pending.push(relative);
      } else if (entry.isFile()) {
        budget.take(skillName, (await lstat(join(sourceDir, relative))).size);
        files.push(relative);
      }
    }
  }
  return { sourceDir, files: files.sort() };
}

/** 付属ファイルのコピー先。展開先の外（や展開先そのもの）を指すなら bad_request（パストラバーサルを防ぐ） */
export function assetTarget(targetDir: string, relative: string): string {
  const target = resolve(targetDir, relative);
  if (isAbsolute(relative) || target === resolve(targetDir) || !isInside(target, targetDir)) {
    throw new BackendError('bad_request', `展開先の外を指す付属ファイルです: ${relative}`);
  }
  return target;
}

export async function copyAssets(plan: AssetPlan, targetDir: string): Promise<void> {
  for (const relative of plan.files) {
    const target = assetTarget(targetDir, relative);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(plan.sourceDir, relative), target);
  }
}
