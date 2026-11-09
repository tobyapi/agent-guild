// tasks ブロックの読み取り（docs/design.md §7.1 の 1。Rust の guild-domain の純粋関数をモック用に）。
// 各行は「@名前: 指示」（全角の ＠・： も可）。@ で始まらない行は直前の指示の続き。名前はメンションと同じ規則で引く。
import { matchMentionAt, sortByNameLength } from '@/shared/lib/mentions';
import type { MentionTarget } from '@/shared/lib/mentions';
import { findTasksBlock } from '@/shared/lib/tasksBlock';
import type { Agent } from '@/shared/types/domain';

/** 1つの割り振りのサブタスクの上限 */
export const MAX_SUBTASKS = 8;

export interface TaskEntry {
  assigneeId: string;
  instruction: string;
}

export interface ParsedTasks {
  /** 書かれた順。同じ担当者の行は指示を改行でつないで1つにする */
  entries: TaskEntry[];
  /** 見つからない・削除済み・自分自身の名前 */
  skipped: string[];
  /** 上限を超えて割り振らなかった担当者の名前 */
  overflow: string[];
}

interface TaskLine {
  name: string;
  targetId: string | null;
  instruction: string;
}

const SEPARATOR = /^[ \t]*[:：][ \t]*/;

function readLine(line: string, targets: readonly MentionTarget[]): TaskLine {
  const target = matchMentionAt(line, targets);
  const separator = target ? SEPARATOR.exec(line.slice(1 + target.name.length)) : null;
  if (target && separator) {
    return { name: target.name, targetId: target.id, instruction: line.slice(1 + target.name.length + separator[0].length).trim() };
  }
  const colon = line.search(/[:：]/);
  return { name: (colon < 0 ? line.slice(1) : line.slice(1, colon)).trim(), targetId: null, instruction: colon < 0 ? '' : line.slice(colon + 1).trim() };
}

function readLines(lines: readonly string[], targets: readonly MentionTarget[]): TaskLine[] {
  const result: TaskLine[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const last = result.at(-1);
    if (line === '') continue;
    if (/^[@＠]/.test(line)) result.push(readLine(line, targets));
    else if (last) last.instruction = last.instruction === '' ? line : `${last.instruction}\n${line}`;
  }
  return result;
}

/** 本文の最初の tasks ブロックを読む（なければ null）。agents は削除されていないエージェント */
export function parseTasks(content: string, agents: readonly Agent[], selfId: string): ParsedTasks | null {
  const block = findTasksBlock(content);
  if (!block) return null;
  const targets = sortByNameLength(agents.map(({ id, name }) => ({ id, name })));
  const byAssignee = new Map<string, string[]>();
  const skipped: string[] = [];
  for (const line of readLines(block.lines, targets)) {
    if (line.targetId === null || line.targetId === selfId) skipped.push(line.name);
    else byAssignee.set(line.targetId, [...(byAssignee.get(line.targetId) ?? []), line.instruction]);
  }
  const all = [...byAssignee].map(([assigneeId, parts]) => ({ assigneeId, instruction: parts.filter((part) => part !== '').join('\n') }));
  const nameOf = (id: string) => agents.find((agent) => agent.id === id)?.name ?? id;
  return {
    entries: all.slice(0, MAX_SUBTASKS),
    skipped: [...new Set(skipped)],
    overflow: all.slice(MAX_SUBTASKS).map((entry) => nameOf(entry.assigneeId)),
  };
}
