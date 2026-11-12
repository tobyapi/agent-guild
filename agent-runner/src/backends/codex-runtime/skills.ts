// Codex にスキルを見せる場所: 作業場所（cwd）の .agents/skills/（Codex はここをリポジトリのスキルとして一覧に載せる）。
// run と image で同じ置き方にする。一覧には名前・説明・パスしか載らず、本文はモデルが道具で SKILL.md を読むか、
// プロンプトのスキルの呼び出しで Codex が差し込む。`$<name>` だけの呼び出しは、同じ名前のスキルがほかの場所（利用者の
// ~/.codex/skills など）にもあると曖昧として差し込まれない（0.163 で確かめた）ので、image では利用者が Codex で頼むときと
// 同じく、書いた SKILL.md へのリンク `[$<name>](<絶対パス>)` にする（Codex はパスでスキルを決めて本文を差し込む）。

import { join } from 'node:path';
import type { SkillPayload } from '../../protocol.ts';
import { skillMarkdown, writeSkills } from '../skill-files.ts';

const skillsDir = (workspace: string): string => join(workspace, '.agents', 'skills');

/** 作業場所の .agents/skills/ を作り直してスキルを書く（不正な name・付属ファイルは bad_request） */
export async function installCodexSkills(workspace: string, skills: readonly SkillPayload[]): Promise<void> {
  await writeSkills(skillsDir(workspace), skills);
}

/** Markdown のリンクの行き先にそのまま書けるパス（空白・括弧を含まない） */
const linkable = (path: string): boolean => !/[\s()<>[\]]/.test(path);

/**
 * prompt の中のスキルの呼び出し `$<name>`（各スキルの最初の1つ）を、installCodexSkills で書いた SKILL.md へのリンクにする。
 * パスがリンクに書けない形なら、かわりに SKILL.md を Codex の差し込みと同じ形（<skill> に name・path・中身）で prompt の前に
 * 置き、呼び出しは名前だけにする（二重に差し込まれないように）。呼び出しのないスキルは一覧に載るだけ
 */
export function referSkills(workspace: string, skills: readonly SkillPayload[], prompt: string): string {
  const blocks: string[] = [];
  let text = prompt;
  for (const skill of skills) {
    const path = join(skillsDir(workspace), skill.name, 'SKILL.md');
    // name は書き出すときに英小文字・数字・ハイフンだけと確かめてある
    const mention = new RegExp(`\\$${skill.name}(?![a-z0-9-])`, linkable(path) ? '' : 'g');
    if (text.search(mention) === -1) continue;
    if (linkable(path)) {
      text = text.replace(mention, () => `[$${skill.name}](${path})`);
      continue;
    }
    text = text.replace(mention, () => skill.name);
    blocks.push(`<skill>\n<name>${skill.name}</name>\n<path>${path}</path>\n${skillMarkdown(skill)}</skill>`);
  }
  return [...blocks, text].join('\n\n');
}
