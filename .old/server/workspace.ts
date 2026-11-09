import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, listSkills } from './db.js';

/**
 * エージェントごとの作業ディレクトリ。
 *   data/agents/<id>/
 *     MEMORY.md                 次回以降の自分へのメモ（プロンプトに毎回差し込む）
 *     .claude/skills/<name>/    Claude 用スキル
 *     .agents/skills/<name>/    Codex 用スキル（同じ内容）
 *     その他                     作業者が作った成果物
 */
export function agentWorkspace(agentId: string): string {
  const dir = path.join(DATA_DIR, 'agents', agentId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readMemory(agentId: string, maxChars = 4000): string {
  const file = path.join(agentWorkspace(agentId), 'MEMORY.md');
  if (!fs.existsSync(file)) return '';
  const text = fs.readFileSync(file, 'utf8');
  return text.length > maxChars ? text.slice(-maxChars) : text;
}

const SKILL_ROOTS = ['.claude/skills', '.agents/skills'];

/** DB のスキルを両バックエンドが読むフォルダに書き出す（DB が正、フォルダは毎回作り直す） */
export function syncSkills(agentId: string) {
  const ws = agentWorkspace(agentId);
  const skills = listSkills(agentId);
  for (const root of SKILL_ROOTS) {
    const dir = path.join(ws, root);
    fs.rmSync(dir, { recursive: true, force: true });
    for (const s of skills) {
      const sd = path.join(dir, s.name);
      fs.mkdirSync(sd, { recursive: true });
      const frontmatter = `---\nname: ${s.name}\ndescription: ${JSON.stringify(s.description)}\n---\n\n`;
      fs.writeFileSync(path.join(sd, 'SKILL.md'), frontmatter + s.body, 'utf8');
    }
  }
}

export function removeWorkspace(agentId: string) {
  fs.rmSync(path.join(DATA_DIR, 'agents', agentId), { recursive: true, force: true });
}

export const skillSlug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'skill';
