// エージェントのタグの規則（docs/design.md §2 入力規則）。モックの検証と UI の事前検査が使う。正はサーバの validation。
import { normalizeName } from './names';
import { textLength } from './validation';

export const TAG_COUNT_MAX = 8;
export const TAG_LENGTH_MAX = 16;

/** 1つのタグの問題（なければ null）。前後の空白は除いて判定する */
export function checkTag(tag: string): string | null {
  const trimmed = tag.trim();
  if (trimmed === '') return 'タグを入力してください';
  if (textLength(trimmed) > TAG_LENGTH_MAX) return `タグは ${TAG_LENGTH_MAX} 文字以内にしてください`;
  if (/[\s#＃,，@＠]/.test(trimmed)) return 'タグに空白・#・,・@ は使えません';
  return null;
}

/** 前後の空白を除き、重複（NFKC＋大文字小文字無視）は最初のものだけ残す（重複はエラーにしない） */
export function cleanTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  return tags
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = normalizeName(tag);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** タグの一覧の問題（なければ null）。重複をまとめたあとで判定する */
export function checkTags(tags: readonly string[]): string | null {
  const cleaned = cleanTags(tags);
  if (cleaned.length > TAG_COUNT_MAX) return `タグは ${TAG_COUNT_MAX} 個までにしてください`;
  for (const tag of cleaned) {
    const problem = checkTag(tag);
    if (problem !== null) return `「${tag}」: ${problem}`;
  }
  return null;
}
