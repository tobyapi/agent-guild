// スキル（SkillPayload）を Agent Skills 標準のフォルダ（<name>/SKILL.md と付属ファイル）として書き出す。
// 置き場所はアダプタが決める。付属ファイルのコピーは skill-files/assets.ts。

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SkillPayload } from '../protocol.ts';
import { ASSET_LIMITS, AssetBudget, copyAssets, planAssets, type AssetLimits, type AssetPlan } from './skill-files/assets.ts';
import { BackendError } from './types.ts';

/** Agent Skills 標準の name（英小文字・数字・ハイフン、64 文字以内、先頭末尾と連続のハイフン不可）。フォルダ名にもなる */
const SKILL_NAME = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/** YAML の front matter つきの SKILL.md（JSON の文字列は YAML のダブルクォート文字列としてそのまま読める） */
export function skillMarkdown(skill: SkillPayload): string {
  return `---\nname: ${skill.name}\ndescription: ${JSON.stringify(skill.description)}\n---\n\n${skill.body}\n`;
}

function assertNames(skills: readonly SkillPayload[]): void {
  const invalid = skills.find((skill) => !SKILL_NAME.test(skill.name));
  if (invalid) throw new BackendError('bad_request', `スキル名が不正です: ${invalid.name}`);
  const names = skills.map((skill) => skill.name);
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate !== undefined) throw new BackendError('bad_request', `スキル名が重複しています: ${duplicate}`);
}

/**
 * dir を作り直して <dir>/<name>/ にスキルを書く。前回の内容（エージェントが書き換えたものを含む）は持ち越さない。
 * dir（ライブラリのフォルダ）のあるスキルは付属ファイルもコピーする。name が不正・付属ファイルが上限超えなら
 * bad_request で、そのときは何も書かない（先に数えてから書く）。
 */
export async function writeSkills(
  dir: string,
  skills: readonly SkillPayload[],
  limits: AssetLimits = ASSET_LIMITS,
): Promise<void> {
  assertNames(skills);
  const budget = new AssetBudget(limits);
  const planned: { skill: SkillPayload; assets: AssetPlan | null }[] = [];
  for (const skill of skills) {
    planned.push({ skill, assets: skill.dir === null ? null : await planAssets(skill.dir, skill.name, budget) });
  }
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const { skill, assets } of planned) {
    const skillDir = join(dir, skill.name);
    await mkdir(skillDir, { recursive: true });
    if (assets !== null) await copyAssets(assets, skillDir);
    // SKILL.md は最後に payload から書く（付属ファイルに同名のものがあっても payload が正）
    await writeFile(join(skillDir, 'SKILL.md'), skillMarkdown(skill), 'utf8');
  }
}
