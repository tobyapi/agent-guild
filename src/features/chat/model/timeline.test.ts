import { describe, expect, it } from 'vitest';
import type { Message, MessageKind } from '@/shared/types/domain';
import { buildTimeline, GROUP_WINDOW_MS } from './timeline';

const base = new Date(2026, 10, 8, 10, 0).getTime();
let counter = 0;

function message(authorId: string, offsetMs: number, kind: MessageKind = 'chat'): Message {
  counter += 1;
  return {
    id: `m${counter}`,
    seq: counter,
    channelId: 'c',
    authorId,
    content: `本文${counter}`,
    attachments: [],
    kind,
    mentions: [],
    replyToId: null,
    rootId: `m${counter}`,
    depth: 0,
    delegationId: null,
    createdAt: base + offsetMs,
  };
}

const shape = (messages: Message[]) =>
  buildTimeline(messages).map((item) => (item.type === 'group' ? `${item.authorId}×${item.messages.length}` : item.type));

describe('buildTimeline', () => {
  it('先頭に日付の区切りを入れ、同じ人の連続投稿をまとめる', () => {
    expect(shape([message('a', 0), message('a', 60_000), message('b', 120_000)])).toEqual(['day', 'a×2', 'b×1']);
  });

  it('間隔が空いたら別のまとまりにする', () => {
    expect(shape([message('a', 0), message('a', GROUP_WINDOW_MS + 1)])).toEqual(['day', 'a×1', 'a×1']);
  });

  it('システム発言は単独で置き、前後のまとまりを切る', () => {
    expect(shape([message('a', 0), message('system', 1000, 'system'), message('a', 2000)])).toEqual([
      'day',
      'a×1',
      'system',
      'a×1',
    ]);
  });

  it('自発投稿とエラー発言は、続いていても必ず新しいまとまりを始める', () => {
    const messages = [
      message('a', 0),
      message('a', 1000, 'autonomous'),
      message('a', 2000, 'autonomous'),
      message('a', 3000, 'error'),
      message('a', 4000, 'error'),
      message('a', 5000),
    ];
    expect(shape(messages)).toEqual(['day', 'a×1', 'a×1', 'a×1', 'a×1', 'a×1', 'a×1']);
  });

  it('breaksGroup が真の発言（割り振りの結果・まとめ）は、続いていても新しいまとまりを始める', () => {
    const first = message('a', 0);
    const result = message('a', 1000);
    const groups = buildTimeline([first, result, message('a', 2000)], (candidate) => candidate.id === result.id);
    expect(groups.map((item) => (item.type === 'group' ? item.messages.map((entry) => entry.id) : item.type))).toEqual([
      'day',
      [first.id],
      [result.id, expect.any(String) as unknown],
    ]);
  });

  it('日付が変わったら区切りを入れる', () => {
    const nextDay = 24 * 60 * 60 * 1000;
    expect(shape([message('a', 0), message('a', nextDay)])).toEqual(['day', 'a×1', 'day', 'a×1']);
  });

  it('空の一覧は空', () => {
    expect(buildTimeline([])).toEqual([]);
  });
});
