import type { ThreadEvent } from '@openai/codex-sdk';
import { describe, expect, it, vi } from 'vitest';
import { codexError, EventReader } from './events.ts';

const message = (text: string): ThreadEvent => ({
  type: 'item.completed',
  item: { id: text, type: 'agent_message', text },
});
const command = (type: 'item.started' | 'item.completed', line: string): ThreadEvent => ({
  type,
  item: {
    id: line,
    type: 'command_execution',
    command: line,
    aggregated_output: '',
    status: type === 'item.started' ? 'in_progress' : 'completed',
  },
});
const todo = (type: 'item.started' | 'item.completed'): ThreadEvent => ({
  type,
  item: { id: 'todo', type: 'todo_list', items: [] },
});
const done: ThreadEvent = {
  type: 'turn.completed',
  usage: {
    input_tokens: 1,
    cached_input_tokens: 0,
    cache_write_input_tokens: 0,
    output_tokens: 1,
    reasoning_output_tokens: 0,
  },
};

function readAll(events: ThreadEvent[]) {
  const onActivity = vi.fn();
  const onPost = vi.fn();
  const reader = new EventReader(onActivity, onPost);
  for (const event of events) reader.read(event);
  return {
    posts: onPost.mock.calls.map(([text]) => text as string),
    activities: onActivity.mock.calls.map(([detail]) => detail as string),
    final: reader.finalText,
  };
}

describe('EventReader', () => {
  it('完了時の使用量を取得し、費用は未取得のままにする', () => {
    const onUsage = vi.fn();
    new EventReader(vi.fn(), vi.fn(), codexError, onUsage).read(done);
    expect(onUsage).toHaveBeenCalledExactlyOnceWith({ inputTokens: 1, outputTokens: 1 });
  });
  it('あとに作業が続いた agent_message は途中の投稿にし、最後のものを最終返答にする', () => {
    const { posts, final } = readAll([
      message('まずテストを流します。'),
      command('item.started', 'npm test'),
      command('item.completed', 'npm test'),
      message('  1件失敗しているので直します。 '),
      message('直しました。全部通っています。'),
      done,
    ]);
    expect(posts).toEqual(['まずテストを流します。', '1件失敗しているので直します。']);
    expect(final).toBe('直しました。全部通っています。');
  });

  it('作業だけで終わった返答は投稿せず、そのまま最終返答にする（to-do の完了は作業に数えない）', () => {
    const { posts, final, activities } = readAll([
      todo('item.started'),
      message('調べた結果です。'),
      todo('item.completed'),
      done,
    ]);
    expect(posts).toEqual([]);
    expect(final).toBe('調べた結果です。');
    expect(activities).toEqual(['書いています…']);
  });

  it('agent_message がなければ最終返答は空。途中経過は作業の開始だけを伝える', () => {
    const { posts, final, activities } = readAll([
      command('item.started', 'ls'),
      command('item.completed', 'ls'),
      done,
    ]);
    expect([posts, final]).toEqual([[], '']);
    expect(activities).toEqual(['コマンド実行: ls']);
  });

  it('失敗は Codex の BackendError にする', () => {
    const reader = new EventReader(vi.fn(), vi.fn());
    expect(() => reader.read({ type: 'turn.failed', error: { message: '429 Too Many Requests' } })).toThrow(
      expect.objectContaining({ code: 'rate_limit' }),
    );
  });
});
