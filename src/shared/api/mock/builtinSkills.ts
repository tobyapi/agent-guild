// モックの内蔵スキル: Rust（guild-domain の skill/builtin.rs）と同じ同梱のフォルダを読む（docs/design.md §14）。
import type { BuiltinSkill, Skill } from '@/shared/types/domain';

const ROOT = '/src/shared/assets/skills/';

const SKILL_FILES = import.meta.glob<string>('/src/shared/assets/skills/*/SKILL.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/** 付属ファイル（パスだけを使う。中身は読み込まない） */
const ALL_FILES = Object.keys(import.meta.glob('/src/shared/assets/skills/*/**/*', { query: '?raw' }));

/** frontmatter の1行の値（"…" と '…' の引用をはずす） */
function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value) as string;
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
  return value;
}

/** 先頭の --- で囲まれた frontmatter の name・description と本文（同梱のファイルは1行の値だけを使う） */
function parse(text: string, files: string[]): BuiltinSkill {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  const yaml = match?.[1] ?? '';
  const field = (key: string) => unquote(new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(yaml)?.[1]?.trim() ?? '');
  const body = (match?.[2] ?? '').replace(/^\n+/, '');
  return { name: field('name'), description: field('description'), body, files };
}

/** そのフォルダの SKILL.md 以外のファイル（フォルダからの相対パス、パスの順） */
function filesOf(folder: string): string[] {
  const prefix = `${ROOT}${folder}/`;
  return ALL_FILES.filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length))
    .filter((path) => path !== 'SKILL.md')
    .sort();
}

const BUILTINS: readonly BuiltinSkill[] = Object.entries(SKILL_FILES)
  .map(([path, text]) => parse(text, filesOf(path.slice(ROOT.length, -'/SKILL.md'.length))))
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

export function listBuiltinSkills(): BuiltinSkill[] {
  return BUILTINS.map((skill) => ({ ...skill, files: [...skill.files] }));
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
