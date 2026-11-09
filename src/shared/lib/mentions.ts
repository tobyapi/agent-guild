// メンション解析。Rust の guild-domain conversation/mentions と同じ規則にそろえる（docs/design.md §8）。
// - 本文と名前を NFKC＋大文字小文字無視で正規化して照合する（全角の「＠」も「@」になる）
// - ``` で囲まれたコードブロックの中は無視する
// - 名前の長い順に「@名前」を探し、見つけたら取り除いてから次を探す（「@ハルカ」が「@ハル」に誤爆しない）
// 削除済みのエージェントは呼び出し側で候補から除くこと。

export interface MentionTarget {
  id: string;
  name: string;
}

const CODE_BLOCK = /```[\s\S]*?(?:```|$)/g;
const MENTION_MARK = /^[@＠]/;

/** 照合用の正規化（NFKC＋小文字化） */
export function normalizeForMention(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

/** コードブロックを同じ長さの空白に置き換える（文字位置は保つ） */
export function blankCodeBlocks(text: string): string {
  return text.replace(CODE_BLOCK, (block) => ' '.repeat(block.length));
}

/** 名前の長い順に並べた新しい配列を返す（名前が空のものは除く） */
export function sortByNameLength<T extends MentionTarget>(targets: readonly T[]): T[] {
  return targets.filter((target) => target.name !== '').sort((a, b) => b.name.length - a.name.length);
}

/** 本文で呼ばれた相手の ID を、本文に現れた順で返す（同じ相手は1回だけ） */
export function parseMentions(text: string, targets: readonly MentionTarget[]): string[] {
  let rest = blankCodeBlocks(normalizeForMention(text));
  const found: Array<{ id: string; index: number }> = [];
  const normalized = targets.map((target) => ({ id: target.id, name: normalizeForMention(target.name) }));
  for (const target of sortByNameLength(normalized)) {
    const token = `@${target.name}`;
    const index = rest.indexOf(token);
    if (index < 0) continue;
    found.push({ id: target.id, index });
    rest = rest.replaceAll(token, ' '.repeat(token.length));
  }
  return found.sort((a, b) => a.index - b.index).map((entry) => entry.id);
}

/**
 * 文字列の先頭の「@名前」に合う相手（Markdown の字句解析から使う）。
 * sortedTargets は sortByNameLength で並べておく。
 */
export function matchMentionAt<T extends MentionTarget>(src: string, sortedTargets: readonly T[]): T | null {
  if (!MENTION_MARK.test(src)) return null;
  const match = sortedTargets.find(
    (target) => normalizeForMention(src.slice(1, 1 + target.name.length)) === normalizeForMention(target.name),
  );
  return match ?? null;
}
