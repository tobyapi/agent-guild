// 発言の a2ui ブロックを読む: 見本どおりならボタン、そうでなければ読める文章の表示（docs/design.md §7.2）。
// 代わりの表示で取り出したラベルは見せるだけで、送信には使わない。
import { HUMAN_ID } from '@/shared/types/domain';
import type { Channel, Message } from '@/shared/types/domain';
import { findA2uiBlock, removeA2uiBlock } from '@/shared/lib/a2uiBlock';
import { removeTasksBlock } from '@/shared/lib/tasksBlock';
import type { AuthorView } from './authors';
import { A2UI_MAX_LENGTH, CHOICE_COUNT, readChoiceSurface, readJson } from './a2uiChoices';

/** unsupported: 3つ読めたがボタンにできない / partial: 一部だけ読めた / unreadable: 読めない */
export type ChoiceFallbackReason = 'unsupported' | 'partial' | 'unreadable';

export type ChoiceRead =
  | { kind: 'buttons'; labels: string[] }
  | { kind: 'fallback'; reason: ChoiceFallbackReason; labels: string[]; raw: string | null };

export interface ChoiceView {
  /** 表示する本文（ブロックを取り除いたもの。複数あるときはそのまま） */
  content: string;
  /** a2ui ブロックがなければ null */
  read: ChoiceRead | null;
}

const DISPLAY_MAX = 120;
/** 見せるだけのラベル: 制御文字・書式文字を除き、長さを切る */
const displayLabel = (label: string) =>
  Array.from(label.replace(/\p{Cc}|\p{Cf}|\p{Zl}|\p{Zp}/gu, ' ').trim())
    .slice(0, DISPLAY_MAX)
    .join('');

/** 読めた JSON から、dataModel.o[].t の文字列だけを取り出す（順序は保ち、欠けは推測しない） */
function labelsFromValue(value: unknown): string[] {
  const surface = (value as { createSurface?: { dataModel?: { o?: unknown } } } | null)?.createSurface;
  const items = surface?.dataModel?.o;
  if (!Array.isArray(items)) return [];
  return items.map((item: unknown) => (item as { t?: unknown } | null)?.t).filter((t) => typeof t === 'string');
}

const ITEM = /\s*\{\s*"t"\s*:\s*("(?:[^"\\\n]|\\.)*")\s*\}\s*,?/y;

/** 壊れた JSON から、"o":[ の後に完結した {"t":"…"} の文字列だけを字句で取り出す */
export function salvageLabels(body: string): string[] {
  const text = body.slice(0, A2UI_MAX_LENGTH);
  const open = /"o"\s*:\s*\[/.exec(text);
  if (!open) return [];
  const labels: string[] = [];
  ITEM.lastIndex = open.index + open[0].length;
  for (let match = ITEM.exec(text); match && labels.length < CHOICE_COUNT + 1; match = ITEM.exec(text)) {
    try {
      labels.push(JSON.parse(match[1] ?? '') as string);
    } catch {
      break;
    }
  }
  return labels;
}

function fallback(labels: string[], raw: string | null): ChoiceRead {
  const shown = labels.slice(0, CHOICE_COUNT).map(displayLabel);
  const reason = labels.length === CHOICE_COUNT ? 'unsupported' : labels.length > 0 ? 'partial' : 'unreadable';
  return { kind: 'fallback', reason, labels: shown, raw: raw === null ? null : raw.slice(0, A2UI_MAX_LENGTH) };
}

/** ブロックの中身を読む。閉じていなければボタンにしない */
export function readChoiceBlock(body: string, closed: boolean): ChoiceRead {
  const json = closed ? readJson(body) : { ok: false as const };
  if (!json.ok) return fallback(salvageLabels(body), body);
  const labels = readChoiceSurface(json.value);
  return labels ? { kind: 'buttons', labels } : fallback(labelsFromValue(json.value), body);
}

/** 確定した AI の発言（kind が chat）だけが対象。人間の発言・途中投稿・自発投稿・エラーは本文そのまま */
export const choiceEligible = (message: Message) => message.kind === 'chat' && message.authorId !== HUMAN_ID;

/** 本文から a2ui ブロックを探して読む。content は表示する本文（tasks ブロックを外したものでもよい） */
export function readChoiceView(message: Message, content: string = message.content): ChoiceView {
  if (!choiceEligible(message)) return { content, read: null };
  const found = findA2uiBlock(content);
  if (found.kind === 'none') return { content, read: null };
  if (found.kind === 'many')
    return { content, read: { kind: 'fallback', reason: 'unreadable', labels: [], raw: null } };
  return {
    content: removeA2uiBlock(content, found.block),
    read: readChoiceBlock(found.block.body, found.block.closed),
  };
}

/** 選択肢を読む本文: 割り振りのある発言は tasks ブロックを外したもの（画面の表示と同じ） */
export const choiceSource = (message: Message) =>
  message.delegationId === null ? message.content : removeTasksBlock(message.content);

/**
 * 押せる提案: 直近の人間の発言より新しく、a2ui ブロックがある最新の発言の id。
 * その発言がボタンにできないとき（壊れている・2つある）は null（古い提案は押せるまま残さない）。
 * システムのお知らせ・エラー・ブロックのない発言は飛ばす（messages は seq の昇順）
 */
export function findActiveProposal(messages: readonly Message[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    if (message.authorId === HUMAN_ID) return null;
    const read = readChoiceView(message, choiceSource(message)).read;
    if (read) return read.kind === 'buttons' ? message.id : null;
  }
  return null;
}

/**
 * 回答済みの印: 人間の発言の直前にある提案（a2ui ブロックのある最新の発言）1件の id → 選んだ番号。
 * その提案がボタンにできないときは印なし。それより古い提案にも印は付けない。
 * 人間の発言が `@{今の名前} {ラベル}` と一致すればその番号、一致しなければ null
 */
export function findAnswers(
  messages: readonly Message[],
  nameOf: (authorId: string) => string,
): Map<string, number | null> {
  const answers = new Map<string, number | null>();
  let nextHuman: Message | null = null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    if (message.authorId === HUMAN_ID) {
      nextHuman = message;
      continue;
    }
    if (!nextHuman) continue;
    const read = readChoiceView(message, choiceSource(message)).read;
    if (!read) continue;
    // 人間の発言に対応するのは直前の提案1件だけ（壊れていても数える。findActiveProposal と同じ数え方）
    const reply = nextHuman.content;
    nextHuman = null;
    if (read.kind !== 'buttons') continue;
    const picked = read.labels.findIndex((label) => reply === `@${nameOf(message.authorId)} ${label}`);
    answers.set(message.id, picked >= 0 ? picked : null);
  }
  return answers;
}

/** 押せるかどうか。open だけが押せる */
export type ChoiceGate = 'open' | 'closed' | 'deleted' | 'outside';

/** 選択肢を押せるか: 発言者が削除済み・不明 → チャンネル外 → 押せる提案（最新の1件）かの順に見る */
export function choiceGate(message: Message, author: AuthorView, channel: Channel, active: string | null): ChoiceGate {
  if (author.deleted) return 'deleted';
  if (!channel.memberIds.includes(message.authorId)) return 'outside';
  return message.id === active ? 'open' : 'closed';
}
