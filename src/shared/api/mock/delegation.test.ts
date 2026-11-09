import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HUMAN_ID, SYSTEM_ID } from '@/shared/types/domain';
import { createHarness } from './harness.test-support';
import type { MockHarness } from './harness.test-support';
import { SEED_IDS } from './seedIds';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** モックの Codex を使えるようにして（カナメが lead として受けられるように）から始める */
async function readyHarness(): Promise<MockHarness> {
  const mock = await createHarness();
  await mock.transport.invoke('refresh_backends', {});
  await vi.advanceTimersByTimeAsync(1000);
  return mock;
}

const send = (mock: MockHarness, content: string) =>
  mock.transport.invoke('send_message', { channelId: SEED_IDS.lobby, content, attachments: [] });

/** 担当者は結果を報告する前に、作業の途中で進捗を投稿している */
function expectProgressBeforeResult(mock: MockHarness, assigneeId: string, resultMessageId: string | null): void {
  const result = mock.messages.find((message) => message.id === resultMessageId);
  expect(result?.authorId).toBe(assigneeId);
  const progress = mock.messages.find((message) => message.kind === 'progress' && message.authorId === assigneeId);
  expect(progress?.content).toMatch(/^進捗: /);
  expect(progress?.seq).toBeLessThan(result?.seq ?? 0);
}

describe('モックの割り振り', () => {
  it('メンションのない依頼は lead のカナメが受け、tasks ブロックで割り振り、担当者の報告がそろったらまとめる', async () => {
    const mock = await readyHarness();
    await send(mock, '新しい社内ツールの名前を考えたい');
    await mock.settle();

    const plan = mock.messages.find((message) => message.authorId === SEED_IDS.kaname && message.delegationId !== null);
    expect(plan?.content).toContain('```tasks');
    const final = mock.delegations.filter((delegation) => delegation.id === plan?.delegationId).at(-1);
    expect(final).toMatchObject({ status: 'done', managerId: SEED_IDS.kaname, messageId: plan?.id });
    expect(final?.subtasks.map((subtask) => [subtask.assigneeId, subtask.status])).toEqual([
      [SEED_IDS.hal, 'done'],
      [SEED_IDS.sora, 'done'],
      [SEED_IDS.logica, 'done'],
    ]);
    for (const subtask of final?.subtasks ?? [])
      expectProgressBeforeResult(mock, subtask.assigneeId, subtask.resultMessageId);
    const summary = mock.messages.find((message) => message.id === final?.summaryMessageId);
    expect(summary).toMatchObject({ authorId: SEED_IDS.kaname, delegationId: null });
    expect(summary?.content).toContain('まとめます');
    // ほかのメンバー（answer のハルなど）は、lead がいるので依頼そのものには答えない
    const request = mock.messages.find(
      (message) => message.authorId === HUMAN_ID && message.content.startsWith('新しい社内'),
    );
    const repliesToRequest = mock.messages.filter((message) => message.replyToId === request?.id);
    expect(repliesToRequest.map((message) => message.authorId)).toEqual([SEED_IDS.kaname]);
  });

  it('サブタスクはチャンネルのレーンを待たずに並行して動き、状態の移り変わりを delegation-changed で流す', async () => {
    const mock = await readyHarness();
    await send(mock, 'リリースの準備をして');
    await mock.settle();
    const statuses = mock.delegations
      .filter((delegation) => delegation.id !== 'demo-delegation')
      .map((delegation) => delegation.status);
    expect(statuses[0]).toBe('running');
    expect(statuses).toContain('reporting');
    expect(statuses.at(-1)).toBe('done');
    expect(
      mock.delegations.some(
        (delegation) => delegation.subtasks.filter((subtask) => subtask.status === 'running').length >= 2,
      ),
    ).toBe(true);
    expect(
      mock.activities.some(
        (state) => state.activities.filter((activity) => activity.channelId === SEED_IDS.lobby).length >= 2,
      ),
    ).toBe(true);
  });

  it('停止すると実行中の割り振りを打ち切り、未決着のサブタスクを中止にする', async () => {
    const mock = await readyHarness();
    await send(mock, '競合を調べて');
    await vi.advanceTimersByTimeAsync(2500);
    await mock.transport.invoke('stop_channel', { channelId: SEED_IDS.lobby });
    await mock.settle();
    const last = mock.delegations.at(-1);
    expect(last?.status).toBe('cancelled');
    expect(last?.subtasks.every((subtask) => subtask.status === 'cancelled' && subtask.note === '停止しました')).toBe(
      true,
    );
    expect(mock.messages.at(-1)).toMatchObject({ authorId: SYSTEM_ID, content: '停止しました' });
  });

  it('list_delegations はチャンネルの割り振りを作成順に返す（初期データの見本を含む）', async () => {
    const mock = await readyHarness();
    await send(mock, '段取りを組んで');
    await mock.settle();
    const listed = await mock.transport.invoke('list_delegations', { channelId: SEED_IDS.lobby });
    expect(listed.map((delegation) => delegation.status)).toEqual(['done', 'done']);
    expect(listed[0]?.id).toBe('demo-delegation');
    await expect(mock.transport.invoke('list_delegations', { channelId: 'nope' })).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});
