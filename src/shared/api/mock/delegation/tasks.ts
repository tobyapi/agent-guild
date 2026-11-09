// tasks ブロックの読み取り（docs/design.md §7.1 の 1）。Rust の guild-domain（delegation/tasks.rs）と同じ規則で、
// contracts/behavior/tasks.json で両方を検査する。
// 各行は「@名前: 指示」（全角の ＠・： も、空白だけの区切りも可）。@ で始まらない行は直前の指示の続き。
// 名前はメンションと同じ規則（NFKC＋大文字小文字無視）で引き、区切りの手前が一致するいちばん長い名前を選ぶ。
import { normalizeForMention } from '@/shared/lib/mentions';
import { findTasksBlock } from '@/shared/lib/tasksBlock';
import type { Agent } from '@/shared/types/domain';

/** 1つの割り振りのサブタスクの上限 */
export const MAX_SUBTASKS = 8;
/** 名前の候補として調べる長さの上限（文字数）。これより長い区切りは名前ではない */
const NAME_PROBE_CHARS = 128;

export interface TaskEntry {
  assigneeId: string;
  instruction: string;
}

export interface ParsedTasks {
  /** 書かれた順。同じ担当者の行は指示を改行でつないで1つにする（指示が空のものは捨てる） */
  entries: TaskEntry[];
  /** 見つからない・削除済み・自分自身の名前 */
  skipped: string[];
  /** 上限を超えて割り振らなかった担当者の名前 */
  overflow: string[];
}

interface Candidate {
  key: string;
  agent: Agent;
}

const isSeparator = (char: string) => char === ':' || char === '：' || /\s/u.test(char);

/** 区切りのあとの指示（先頭の空白と : を1つ除く） */
function instructionAfter(rest: string): string {
  const text = rest.trimStart();
  return (text.startsWith(':') || text.startsWith('：') ? text.slice(1) : text).trim();
}

/** 「名前: 指示」の名前を引く。区切り（: ・ ： ・空白）の手前が名前に一致する候補のうち、いちばん長い名前を選ぶ */
function resolve(rest: string, candidates: readonly Candidate[]): { agent: Agent; instruction: string } | null {
  const chars = [...rest];
  const ends = [...chars.keys()].filter((index) => isSeparator(chars[index] ?? '')).concat(chars.length);
  let best: { length: number; agent: Agent; end: number } | null = null;
  for (const end of ends) {
    if (end > NAME_PROBE_CHARS) break;
    const key = normalizeForMention(chars.slice(0, end).join('').trim());
    const found = candidates.find((candidate) => candidate.key === key);
    const length = [...key].length;
    if (found && (best === null || length > best.length)) best = { length, agent: found.agent, end };
  }
  return best && { agent: best.agent, instruction: instructionAfter(chars.slice(best.end).join('')) };
}

/** 割り振れなかった行に書かれていた名前 */
function writtenName(rest: string): string {
  const chars = [...rest];
  const end = chars.findIndex(isSeparator);
  const name = chars
    .slice(0, end < 0 ? chars.length : end)
    .join('')
    .trim();
  return name === '' ? '（名前なし）' : name;
}

function append(entry: TaskEntry, text: string): void {
  if (text === '') return;
  entry.instruction = entry.instruction === '' ? text : `${entry.instruction}\n${text}`;
}

/** 本文の最初の tasks ブロックを読む（なければ null）。agents は削除されていないエージェント */
export function parseTasks(content: string, agents: readonly Agent[], selfId: string): ParsedTasks | null {
  const block = findTasksBlock(content);
  if (!block) return null;
  const candidates = agents
    .map((agent) => ({ key: normalizeForMention(agent.name), agent }))
    .filter((candidate) => candidate.key !== '');
  const entries: TaskEntry[] = [];
  const skipped: string[] = [];
  // 続きの行をつなぐ先（割り振れなかった行の続きは捨てる）
  let target: TaskEntry | null = null;
  for (const line of block.lines.map((raw) => raw.trim()).filter((text) => text !== '')) {
    if (!/^[@＠]/.test(line)) {
      if (target) append(target, line);
      continue;
    }
    const rest = line.slice(1);
    const found = resolve(rest, candidates);
    if (found && found.agent.id !== selfId) {
      const known = entries.find((entry) => entry.assigneeId === found.agent.id);
      target = known ?? { assigneeId: found.agent.id, instruction: '' };
      if (!known) entries.push(target);
      append(target, found.instruction);
      continue;
    }
    const name = found ? found.agent.name : writtenName(rest);
    if (!skipped.includes(name)) skipped.push(name);
    target = null;
  }
  const assigned = entries.filter((entry) => entry.instruction !== '');
  const nameOf = (id: string) => agents.find((agent) => agent.id === id)?.name ?? id;
  return {
    entries: assigned.slice(0, MAX_SUBTASKS),
    skipped,
    overflow: assigned.slice(MAX_SUBTASKS).map((entry) => nameOf(entry.assigneeId)),
  };
}
