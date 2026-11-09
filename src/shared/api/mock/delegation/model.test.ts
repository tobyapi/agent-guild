import { describe, expect, it } from 'vitest';
import type { Delegation } from '@/shared/types/domain';
import { allSettled, cancelDelegation, isOpen, reportLines, settleSubtask, startSubtask } from './model';

const delegation: Delegation = {
  id: 'd1',
  channelId: 'c1',
  managerId: 'kaname',
  messageId: 'm1',
  status: 'running',
  subtasks: [
    { id: 's1', assigneeId: 'hal', instruction: '調べて', status: 'pending', resultMessageId: null, note: null },
    { id: 's2', assigneeId: 'sora', instruction: '作って', status: 'pending', resultMessageId: null, note: null },
  ],
  summaryMessageId: null,
  createdAt: 0,
  updatedAt: 0,
};

describe('サブタスクの移り変わり', () => {
  it('実行が始まったら running、決着したら結果を入れ、決着済みは変えない', () => {
    const started = startSubtask(delegation, 's1', 5);
    expect(started.subtasks[0]?.status).toBe('running');
    expect(started.updatedAt).toBe(5);
    const done = settleSubtask(started, 's1', { status: 'done', resultMessageId: 'r1', note: null }, 6);
    expect(done.subtasks[0]).toMatchObject({ status: 'done', resultMessageId: 'r1' });
    const again = settleSubtask(done, 's1', { status: 'failed', resultMessageId: null, note: 'x' }, 7);
    expect(again.subtasks[0]?.status).toBe('done');
  });

  it('すべてが pending / running でなくなったら待ち合わせが終わる', () => {
    const one = settleSubtask(delegation, 's1', { status: 'done', resultMessageId: 'r1', note: null }, 1);
    expect(allSettled(one)).toBe(false);
    expect(allSettled(settleSubtask(one, 's2', { status: 'failed', resultMessageId: null, note: '回答がありませんでした' }, 2))).toBe(true);
  });

  it('打ち切りでは未決着のサブタスクだけを理由つきで cancelled にする', () => {
    const one = settleSubtask(delegation, 's1', { status: 'done', resultMessageId: 'r1', note: null }, 1);
    const cancelled = cancelDelegation(one, '停止しました', 2);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.subtasks.map((subtask) => [subtask.status, subtask.note])).toEqual([
      ['done', null],
      ['cancelled', '停止しました'],
    ]);
    expect(isOpen(cancelled)).toBe(false);
    expect(isOpen({ ...delegation, status: 'reporting' })).toBe(true);
  });
});

describe('reportLines', () => {
  it('担当者・指示・状態・結果か理由をサブタスクごとに並べる', () => {
    const settled = settleSubtask(
      settleSubtask(delegation, 's1', { status: 'done', resultMessageId: 'r1', note: null }, 1),
      's2',
      { status: 'failed', resultMessageId: null, note: '回答がありませんでした' },
      2,
    );
    const names: Record<string, string> = { hal: 'ハル', sora: 'ソラ' };
    expect(reportLines(settled, (id) => names[id] ?? id, (subtask) => (subtask.resultMessageId ? '表にしました' : null))).toEqual([
      'ハル｜調べて｜完了｜表にしました',
      'ソラ｜作って｜失敗｜回答がありませんでした',
    ]);
  });
});
