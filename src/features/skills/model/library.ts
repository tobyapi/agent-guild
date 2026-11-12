// スキルライブラリの表示の判断（追加できるか・検索・フォルダの並べ替え）。正はサーバの検証。
import { normalizeName } from '@/shared/lib/names';
import { isInsidePath, isSamePath } from '@/shared/lib/paths';
import type { BuiltinSkill, LibrarySkill, Skill, SkillLibrary } from '@/shared/types/domain';
import { tLibrary as t } from '../i18n/library';

/** ライブラリのスキルを、そのエージェントに追加できるか */
export type LibraryEntryState =
  | { kind: 'available' }
  /** 同じフォルダをリンク済み */
  | { kind: 'added' }
  /** 同じ name のスキルがすでにある（書いたもの・コピーしたもの・別のフォルダのリンク） */
  | { kind: 'nameTaken' }
  /** SKILL.md が標準に合わない */
  | { kind: 'problem'; reason: string };

export function libraryEntryState(entry: LibrarySkill, agentSkills: readonly Skill[]): LibraryEntryState {
  if (agentSkills.some((skill) => skill.source?.kind === 'linked' && isSamePath(skill.source.path, entry.path)))
    return { kind: 'added' };
  if (entry.problem !== null) return { kind: 'problem', reason: entry.problem };
  if (agentSkills.some((skill) => skill.name === entry.name)) return { kind: 'nameTaken' };
  return { kind: 'available' };
}

/** 内蔵スキルを、そのエージェントに追加できるか（同じ内蔵スキルを参照済みなら added） */
export function builtinEntryState(
  entry: BuiltinSkill,
  agentSkills: readonly Skill[],
): Exclude<LibraryEntryState, { kind: 'problem' }> {
  if (agentSkills.some((skill) => skill.source?.kind === 'builtin' && skill.source.name === entry.name))
    return { kind: 'added' };
  if (agentSkills.some((skill) => skill.name === entry.name)) return { kind: 'nameTaken' };
  return { kind: 'available' };
}

/** 検索: 空白で区切った語をすべて name・description・パスのどれかに含むもの（NFKC＋大文字小文字無視） */
export function searchLibrary(skills: readonly LibrarySkill[], query: string): LibrarySkill[] {
  const words = normalizeName(query)
    .split(/\s+/)
    .filter((word) => word !== '');
  if (words.length === 0) return [...skills];
  return skills.filter((skill) => {
    const haystack = normalizeName(`${skill.name} ${skill.description} ${skill.path}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** そのフォルダで見つかったスキルの数 */
export function skillCountIn(library: SkillLibrary, dir: string): number {
  return library.skills.filter((skill) => skill.libraryDir === dir).length;
}

/** 並べ替え: index の項目を delta だけ動かす（端を越えるなら元のまま） */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  const item = items[index];
  if (item === undefined || target < 0 || target >= items.length) return [...items];
  const rest = items.filter((_, position) => position !== index);
  return [...rest.slice(0, target), item, ...rest.slice(target)];
}

/** 足す前の確認（同じフォルダ・入れ子）。問題なければ null */
export function checkNewDir(dirs: readonly string[], path: string): string | null {
  if (dirs.some((dir) => isSamePath(dir, path))) return t('dirAlready');
  const parent = dirs.find((dir) => isInsidePath(path, dir));
  if (parent) return t('dirInside', { parent });
  const child = dirs.find((dir) => isInsidePath(dir, path));
  if (child) return t('dirContains', { child });
  return null;
}
