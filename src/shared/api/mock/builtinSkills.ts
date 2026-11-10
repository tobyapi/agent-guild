// モックの内蔵スキル: Rust（guild-domain の skill/builtin.rs）と同じ同梱の SKILL.md を読む（docs/design.md §14）。
import type { BuiltinSkill, Skill } from '@/shared/types/domain';

const FILES = import.meta.glob<string>('/src/shared/assets/skills/*/SKILL.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/** 先頭の --- で囲まれた frontmatter の name・description と本文（同梱のファイルは1行の値だけを使う） */
function parse(text: string): BuiltinSkill {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  const yaml = match?.[1] ?? '';
  const field = (key: string) => new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(yaml)?.[1]?.trim() ?? '';
  return { name: field('name'), description: field('description'), body: (match?.[2] ?? '').replace(/^\n+/, '') };
}

const BUILTINS: readonly BuiltinSkill[] = Object.values(FILES)
  .map(parse)
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

export function listBuiltinSkills(): BuiltinSkill[] {
  return BUILTINS.map((skill) => ({ ...skill }));
}

export function findBuiltinSkill(name: string): BuiltinSkill | undefined {
  return BUILTINS.find((skill) => skill.name === name);
}

/** 内蔵スキルを参照するスキルは、取得のたびに同梱の SKILL.md を読み直した値にする（この版になければ problem に理由） */
export function readBuiltinSkill(skill: Skill, name: string): Skill {
  const found = findBuiltinSkill(name);
  if (!found) return { ...skill, problem: `内蔵スキル「${name}」はこの版のアプリにありません` };
  return { ...skill, name: found.name, description: found.description, body: found.body, problem: null };
}
