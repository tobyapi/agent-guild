import { describe, expect, it } from 'vitest';
import type { Message } from '@/shared/types/domain';
import { mentionsHuman, mergeMessages } from './messages';

const message = (seq: number, overrides: Partial<Message> = {}): Message => ({
  id: `m${seq}`,
  seq,
  channelId: 'c',
  authorId: 'hal',
  content: '',
  attachments: [],
  kind: 'chat',
  mentions: [],
  replyToId: null,
  rootId: `m${seq}`,
  depth: 0,
  delegationId: null,
  createdAt: seq,
  ...overrides,
});

describe('mergeMessages', () => {
  it('同じ発言が二度届いても1件にし、seq の順に並べる', () => {
    const merged = mergeMessages([message(1), message(3)], [message(2), message(3)]);
    expect(merged.map((item) => item.seq)).toEqual([1, 2, 3]);
  });

  it('過去のページを前に足す', () => {
    expect(mergeMessages([message(5), message(6)], [message(3), message(4)]).map((item) => item.seq)).toEqual([3, 4, 5, 6]);
  });

  it('最新の1件は末尾に足す（すでにあれば足さない）', () => {
    const current = [message(1), message(2)];
    expect(mergeMessages(current, [message(3)]).map((item) => item.seq)).toEqual([1, 2, 3]);
    expect(mergeMessages(current, [message(2)])).toHaveLength(2);
  });
});

describe('mentionsHuman', () => {
  it('エージェントの発言で自分の名前が呼ばれていれば true', () => {
    expect(mentionsHuman(message(1, { content: '@あなた 確認お願いします' }), 'あなた')).toBe(true);
    expect(mentionsHuman(message(1, { content: 'あなた へ' }), 'あなた')).toBe(false);
    expect(mentionsHuman(message(1, { authorId: 'me', content: '@あなた' }), 'あなた')).toBe(false);
  });
});
