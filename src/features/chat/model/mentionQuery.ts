// 入力欄のメンション補完の純粋なロジック（docs/ui-design.md §5.6）。
import type { Agent } from '@/shared/types/domain';

export interface MentionQuery {
  /** 「@」の位置 */
  start: number;
  /** 「@」のあとに打った文字 */
  query: string;
}

const QUERY_BEFORE_CARET = /[@＠]([^\s@＠]*)$/;

/**
 * キャレットの直前で入力中のメンション。なければ null。
 * 日本語は語の間に空白を入れないので、「@」の前の文字は問わない。
 */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const match = QUERY_BEFORE_CARET.exec(text.slice(0, caret));
  if (!match) return null;
  const query = match[1] ?? '';
  return { start: caret - query.length - 1, query };
}

/**
 * 入力中のメンションを取り直す。中身（「@」の位置と打った文字）が同じなら current をそのまま返す。
 * 値を置き換えないので、そのメンションに対する候補の選択（mentionSelection）も保たれる
 */
export function refreshMentionQuery(current: MentionQuery | null, text: string, caret: number): MentionQuery | null {
  const next = findMentionQuery(text, caret);
  if (current === null || next === null) return next;
  return current.start === next.start && current.query === next.query ? current : next;
}

/** 候補の絞り込み: 前方一致を先に、続けて部分一致（大文字小文字は区別しない。同順位は元の並びを保つ） */
export function filterMentionCandidates<T extends { name: string }>(
  candidates: readonly T[],
  query: string,
  limit = 8,
): T[] {
  const needle = query.toLowerCase();
  return candidates
    .map((candidate) => ({ candidate, index: candidate.name.toLowerCase().indexOf(needle) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => Number(a.index > 0) - Number(b.index > 0))
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

/** 入力中のメンションを「@名前 」に置き換えた本文と、その直後のキャレット位置 */
export function insertMention(
  text: string,
  query: MentionQuery,
  caret: number,
  name: string,
): { text: string; caret: number } {
  const inserted = `@${name} `;
  return {
    text: text.slice(0, query.start) + inserted + text.slice(caret),
    caret: query.start + inserted.length,
  };
}

export interface MentionOption {
  agent: Agent;
  name: string;
  /** チャンネル外の相手は「チャンネル外 — 呼ぶと参加します」の下に分けて出す */
  isMember: boolean;
}

/** 候補: 削除されていないエージェントを、メンバー → チャンネル外 の順に（それぞれ作成順） */
export function buildMentionOptions(agents: readonly Agent[], memberIds: readonly string[]): MentionOption[] {
  const options = agents
    .filter((agent) => agent.deletedAt === null)
    .map((agent) => ({ agent, name: agent.name, isMember: memberIds.includes(agent.id) }));
  return [...options.filter((option) => option.isMember), ...options.filter((option) => !option.isMember)];
}

/** 名前のうち入力に一致した部分を強調できるように分ける */
export function highlightParts(name: string, query: string): Array<{ text: string; match: boolean }> {
  const index = query === '' ? -1 : name.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return [{ text: name, match: false }];
  const end = index + query.length;
  return [
    { text: name.slice(0, index), match: false },
    { text: name.slice(index, end), match: true },
    { text: name.slice(end), match: false },
  ].filter((part) => part.text !== '');
}
