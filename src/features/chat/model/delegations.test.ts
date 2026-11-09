import { describe, expect, it } from 'vitest';
import type { Delegation, Subtask } from '@/shared/types/domain';
import { isNewer, progressText, resultLink, subtaskNote, taskLinkIndex } from './delegations';

const subtask = (id: string, overrides: Partial<Subtask> = {}): Subtask => ({
  id,
  assigneeId: `agent-${id}`,
  instruction: '調べて',
  status: 'pending',
  resultMessageId: null,
  note: null,
  ...overrides,
});

const delegation = (overrides: Partial<Delegation> = {}): Delegation => ({
  id: 'd1',
  channelId: 'c1',
  managerId: 'kaname',
  messageId: 'plan',
  status: 'running',
  subtasks: [
    subtask('a', { status: 'done', resultMessageId: 'r1' }),
    subtask('b', { status: 'running' }),
    subtask('c'),
  ],
  summaryMessageId: null,
  createdAt: 0,
  updatedAt: 10,
  ...overrides,
});

describe('progressText', () => {
  it('「3 件中 1 件完了」。失敗があれば「 · 失敗 1」を添える', () => {
    expect(progressText(delegation())).toBe('3 件中 1 件完了');
    const failed = delegation({
      subtasks: [subtask('a', { status: 'done' }), subtask('b', { status: 'failed', note: '時間切れで中断しました' })],
    });
    expect(progressText(failed)).toBe('2 件中 1 件完了 · 失敗 1');
  });
});

describe('resultLink / subtaskNote', () => {
  it('完了は「結果を見る」、エラー発言のある失敗は「エラーを見る」、それ以外は導線なし', () => {
    expect(resultLink(subtask('a', { status: 'done', resultMessageId: 'r1' }))).toEqual({
      messageId: 'r1',
      label: '結果を見る',
    });
    expect(resultLink(subtask('a', { status: 'failed', resultMessageId: 'e1' }))).toEqual({
      messageId: 'e1',
      label: 'エラーを見る',
    });
    expect(resultLink(subtask('a', { status: 'failed', note: '回答がありませんでした' }))).toBeNull();
    expect(resultLink(subtask('a', { status: 'running' }))).toBeNull();
  });

  it('理由は失敗と中止のときだけ出す', () => {
    expect(subtaskNote(subtask('a', { status: 'failed', note: '回答がありませんでした' }))).toBe(
      '回答がありませんでした',
    );
    expect(subtaskNote(subtask('a', { status: 'cancelled', note: '停止しました' }))).toBe('停止しました');
    expect(subtaskNote(subtask('a', { status: 'running', note: '関係ない' }))).toBeNull();
  });
});

describe('taskLinkIndex', () => {
  it('結果とまとめの発言から、カードのある割り振りの発言へ戻れる', () => {
    const done = delegation({
      id: 'd2',
      messageId: 'plan2',
      status: 'done',
      summaryMessageId: 's2',
      subtasks: [subtask('z', { status: 'failed', resultMessageId: 'err' })],
    });
    const index = taskLinkIndex([delegation(), done]);
    expect(index.get('r1')).toEqual({ kind: 'result', planMessageId: 'plan' });
    expect(index.get('err')).toEqual({ kind: 'result', planMessageId: 'plan2' });
    expect(index.get('s2')).toEqual({ kind: 'summary', planMessageId: 'plan2' });
    expect(index.size).toBe(3);
  });
});

describe('isNewer', () => {
  it('updatedAt が同じか新しいものだけで置き換える', () => {
    expect(isNewer(delegation({ updatedAt: 11 }), delegation())).toBe(true);
    expect(isNewer(delegation({ updatedAt: 10 }), delegation())).toBe(true);
    expect(isNewer(delegation({ updatedAt: 9 }), delegation())).toBe(false);
    expect(isNewer(delegation(), undefined)).toBe(true);
  });
});
