// タグの入力欄で打った文字をタグにする（規則は shared/lib/tags。重複は黙ってまとめる）。
import { checkTag, cleanTags, TAG_COUNT_MAX } from '@/shared/lib/tags';
import { tBrain } from '../i18n/brain';

export type TagCommit = { ok: true; tags: string[] } | { ok: false; error: string };

/** タグの区切り（空白・カンマ・読点） */
export const TAG_SEPARATOR = /[\s,，、]/;

/** 区切りで分けて足す。1つでも規則に反すれば何も足さずに理由を返す */
export function commitTagText(current: readonly string[], text: string): TagCommit {
  const parts = text.split(new RegExp(`${TAG_SEPARATOR.source}+`)).filter((part) => part !== '');
  for (const part of parts) {
    const problem = checkTag(part);
    if (problem !== null) return { ok: false, error: tBrain('tagProblem', { tag: part, problem }) };
  }
  const tags = cleanTags([...current, ...parts]);
  if (tags.length > TAG_COUNT_MAX) return { ok: false, error: tBrain('tagCountMax', { max: TAG_COUNT_MAX }) };
  return { ok: true, tags };
}

/** タグを外す */
export function removeTag(current: readonly string[], index: number): string[] {
  return current.filter((_, position) => position !== index);
}

/** タグを先頭にする（先頭のタグがサイドバーの区分と札になる） */
export function promoteTag(current: readonly string[], index: number): string[] {
  const tag = current[index];
  return tag === undefined ? [...current] : [tag, ...removeTag(current, index)];
}
