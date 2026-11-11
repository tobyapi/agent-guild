// 内蔵スキルの付属ファイル（SkillPayload.files）: パスを確かめて上限に数え、スキルのフォルダへ書く。

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { SkillPayload } from '../../protocol.ts';
import { BackendError } from '../types.ts';
import type { AssetBudget } from './assets.ts';

/** / 区切りの相対パスで、.. や空の区切り・ドライブ・\ を含まず、SKILL.md そのものでない */
function isSafePath(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\\') || path.includes(':')) return false;
  const parts = path.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return false;
  return !(parts.length === 1 && path.toLowerCase() === 'skill.md');
}

/** 書く前に、パスが不正なら bad_request。大きさは dir の付属ファイルと同じ上限に数える */
export function planBundledFiles(skill: SkillPayload, budget: AssetBudget): void {
  for (const file of skill.files) {
    if (!isSafePath(file.path)) {
      throw new BackendError('bad_request', `スキル ${skill.name} の付属ファイルのパスが不正です: ${file.path}`);
    }
    budget.take(skill.name, Buffer.byteLength(file.content, 'utf8'));
  }
}

export async function writeBundledFiles(skill: SkillPayload, skillDir: string): Promise<void> {
  for (const file of skill.files) {
    const target = join(skillDir, ...file.path.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf8');
  }
}
