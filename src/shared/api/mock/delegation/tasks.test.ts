import { describe, expect, it } from 'vitest';
import type { Agent } from '@/shared/types/domain';
import { MAX_SUBTASKS, parseTasks } from './tasks';

const agent = (id: string, name: string) => ({ id, name, deletedAt: null }) as Agent;
const agents = [agent('kaname', 'カナメ'), agent('hal', 'ハル'), agent('haruka', 'ハルカ'), agent('sora', 'ソラ')];
const block = (...lines: string[]) => ['分けて進めます。', '', '```tasks', ...lines, '```'].join('\n');

describe('parseTasks', () => {
  it('「@名前: 指示」を読み、@ で始まらない行は直前の指示の続きにする（空行は無視）', () => {
    const parsed = parseTasks(block('@ハル: 調べて', '', '@ソラ: 作って', '  （手順は README に）'), agents, 'kaname');
    expect(parsed).toEqual({
      entries: [
        { assigneeId: 'hal', instruction: '調べて' },
        { assigneeId: 'sora', instruction: '作って\n（手順は README に）' },
      ],
      skipped: [],
      overflow: [],
    });
  });

  it('全角の ＠・：、大文字小文字や全角半角の違いを許し、長い名前を優先する', () => {
    expect(parseTasks(block('＠ハルカ：まとめて', '@ﾊﾙ : 調べて'), agents, 'kaname')?.entries).toEqual([
      { assigneeId: 'haruka', instruction: 'まとめて' },
      { assigneeId: 'hal', instruction: '調べて' },
    ]);
  });

  it('見つからない名前と自分自身は飛ばして名前を返し、同じ担当者の行は1つにまとめる', () => {
    const parsed = parseTasks(block('@ミライ: a', '@カナメ: b', '@ハル: c', '@ハル: d'), agents, 'kaname');
    expect(parsed?.entries).toEqual([{ assigneeId: 'hal', instruction: 'c\nd' }]);
    expect(parsed?.skipped).toEqual(['ミライ', 'カナメ']);
  });

  it(`サブタスクは ${MAX_SUBTASKS} 件まで。超えた担当者の名前を返す`, () => {
    const many = Array.from({ length: MAX_SUBTASKS + 1 }, (_, index) => agent(`a${index}`, `メンバー${index}`));
    const parsed = parseTasks(block(...many.map((member) => `@${member.name}: 作業`)), many, 'kaname');
    expect(parsed?.entries).toHaveLength(MAX_SUBTASKS);
    expect(parsed?.overflow).toEqual([`メンバー${MAX_SUBTASKS}`]);
  });

  it('tasks ブロックがなければ null（ブロックの外のメンションは読まない）', () => {
    expect(parseTasks('@ハル: お願いします', agents, 'kaname')).toBeNull();
  });
});
