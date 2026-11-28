// 選択肢ボタンのテスト用: 指示文（rules.rs）の見本そのものと、発言の組み立て。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HUMAN_ID } from '@/shared/types/domain';
import type { Message } from '@/shared/types/domain';

// jsdom の環境では import.meta.url が file: でないので、リポジトリの根（vitest の実行場所）から読む
const rules = readFileSync(resolve(process.cwd(), 'src-tauri/crates/guild-domain/src/prompt/rules.rs'), 'utf8');

/** 指示文に載っている見本の JSON（```a2ui の次の1行） */
export const PROMPT_SAMPLE = (() => {
  const lines = rules.split(/\r?\n/);
  const at = lines.findIndex((line) => line.trim() === '```a2ui');
  return lines[at + 1] ?? '';
})();

export const SAMPLE_LABELS = ['A. 調査だけ進める', 'B. 設計案まで作る', 'C. ここで止める'];

export type Surface = {
  version: string;
  createSurface: Record<string, unknown> & { dataModel: { o: { t: string }[] }; components: Record<string, unknown>[] };
};

/** 見本を読んだもの（テストごとに書き換えてよい新しいオブジェクト） */
export const sampleSurface = (): Surface => JSON.parse(PROMPT_SAMPLE) as Surface;

export const fence = (json: string, close = true) => ['```a2ui', json, ...(close ? ['```'] : [])].join('\n');

/** 質問とブロック（と後ろに続けるもの） */
export const proposal = (json: string = PROMPT_SAMPLE, ...after: string[]) =>
  ['どこまで進める？', '', fence(json), ...after.flatMap((part) => ['', part])].join('\n');

let seq = 0;
export function message(overrides: Partial<Message> = {}): Message {
  seq += 1;
  const id = overrides.id ?? `m${seq}`;
  return {
    id,
    seq,
    channelId: 'c',
    authorId: 'agent-a',
    content: proposal(),
    skillUsage: null,
    attachments: [],
    kind: 'chat',
    mentions: [],
    replyToId: null,
    rootId: id,
    depth: 1,
    delegationId: null,
    createdAt: seq,
    ...overrides,
  };
}

export const humanMessage = (content = 'ふつうの返事') =>
  message({ authorId: HUMAN_ID, content, depth: 0, kind: 'chat' });
