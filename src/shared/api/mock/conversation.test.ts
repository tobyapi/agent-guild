import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HUMAN_ID, SYSTEM_ID } from '@/shared/types/domain';
import { SEED_IDS } from './seedIds';
import { createHarness } from './harness.test-support';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const authorsAfter = (messages: { authorId: string; seq: number }[], seq: number) =>
  messages.filter((message) => message.seq > seq).map((message) => message.authorId);

describe('モックの会話', () => {
  it('人間の発言も message-created で届き、メンションなしならバックエンドが ready の作業者だけが返答する', async () => {
    const mock = await createHarness();
    const sent = await mock.transport.invoke('send_message', { channelId: SEED_IDS.lobby, content: 'こんにちは', attachments: [] });
    await mock.settle();
    expect(mock.messages[0]).toEqual(sent);
    expect(authorsAfter(mock.messages, 0)).toEqual([HUMAN_ID, SEED_IDS.hal]);
    expect(mock.activities.some((state) => state.queues.some((queue) => queue.running === 1))).toBe(true);
    expect(mock.activities.at(-1)).toEqual({ activities: [], queues: [] });
  });

  it('メンションした相手がチャンネル外なら参加させてから返答する', async () => {
    const mock = await createHarness();
    const channel = await mock.transport.invoke('create_channel', { name: '企画', topic: '', memberIds: [] });
    await mock.transport.invoke('send_message', { channelId: channel.id, content: '@ロジカ 見てください', attachments: [] });
    await mock.settle();
    const notices = mock.messages.filter((message) => message.authorId === SYSTEM_ID).map((message) => message.content);
    expect(notices).toEqual(['ロジカ がチャンネルに参加しました']);
    expect(mock.messages.at(-1)?.authorId).toBe(SEED_IDS.logica);
  });

  it('作業者がレビューを頼むと相談相手が答え、作業者に戻って往復が終わる', async () => {
    const mock = await createHarness();
    const sent = await mock.transport.invoke('send_message', {
      channelId: SEED_IDS.lobby,
      content: '@ハル この企画をレビューしてもらって',
      attachments: [],
    });
    await mock.settle();
    const thread = mock.messages.filter((message) => message.rootId === sent.id);
    expect(thread.map((message) => message.authorId)).toEqual([HUMAN_ID, SEED_IDS.hal, SEED_IDS.logica, SEED_IDS.hal]);
    expect(thread.map((message) => message.depth)).toEqual([0, 1, 2, 3]);
    expect(thread[1]?.mentions).toEqual([SEED_IDS.logica]);
  });

  it('バックエンドの準備ができていないエージェントは失敗の発言（error）を出す', async () => {
    const mock = await createHarness();
    await mock.transport.invoke('send_message', { channelId: SEED_IDS.lobby, content: '@ソラ ビルドして', attachments: [] });
    await mock.settle();
    const reply = mock.messages.at(-1);
    expect(reply).toMatchObject({ authorId: SEED_IDS.sora, kind: 'error' });
    expect(reply?.content).toContain('codex login');
  });

  it('refresh_backends でバックエンドが ready になり、state-changed が届く', async () => {
    const mock = await createHarness();
    await mock.transport.invoke('refresh_backends', {});
    await mock.settle();
    const snapshot = await mock.transport.invoke('get_snapshot', {});
    expect(snapshot.backends.every((backend) => backend.status === 'ready')).toBe(true);
    expect(mock.stateChanges.length).toBeGreaterThan(0);
  });

  it('stop_channel で待機を捨てて実行中を中断し、「停止しました」を出す', async () => {
    const mock = await createHarness();
    await mock.transport.invoke('send_message', { channelId: SEED_IDS.lobby, content: '@ハル @ロジカ よろしく', attachments: [] });
    await vi.advanceTimersByTimeAsync(100);
    await mock.transport.invoke('stop_channel', { channelId: SEED_IDS.lobby });
    await mock.settle();
    const last = mock.messages.at(-1);
    expect(last).toMatchObject({ authorId: SYSTEM_ID, content: '停止しました' });
    expect(mock.messages.filter((message) => message.authorId === SEED_IDS.hal)).toEqual([]);
    expect(mock.activities.at(-1)).toEqual({ activities: [], queues: [] });
  });

  it('自発活動: 誰でも自分を起点にした自発の発言を出す。どのチャンネルにもいなければ validation', async () => {
    const mock = await createHarness();
    await mock.transport.invoke('run_autonomous', { agentId: SEED_IDS.logica });
    await mock.settle();
    const post = mock.messages.at(-1);
    expect(post).toMatchObject({ authorId: SEED_IDS.logica, kind: 'autonomous', depth: 1 });
    expect(post?.rootId).toBe(post?.id);
    await mock.transport.invoke('remove_channel_member', { channelId: SEED_IDS.lobby, memberId: SEED_IDS.hal });
    await expect(mock.transport.invoke('run_autonomous', { agentId: SEED_IDS.hal })).rejects.toMatchObject({
      code: 'validation',
    });
  });
});
