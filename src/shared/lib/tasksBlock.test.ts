import { describe, expect, it } from 'vitest';
import { findTasksBlock, removeTasksBlock } from './tasksBlock';

const reply = ['2つに分けて進めます。', '', '```tasks', '@ハル: 調べて', '@ソラ: 作って', '  （手順は README に）', '```', '', 'よろしくお願いします。'].join('\n');

describe('findTasksBlock', () => {
  it('最初の ```tasks ブロックの中の行と、囲みを含む行の範囲を返す', () => {
    expect(findTasksBlock(reply)).toEqual({ lines: ['@ハル: 調べて', '@ソラ: 作って', '  （手順は README に）'], start: 2, end: 7 });
  });

  it('ほかの言語のコードブロックは対象外。閉じがなければ本文の終わりまで', () => {
    expect(findTasksBlock('```ts\nconst a = 1;\n```')).toBeNull();
    expect(findTasksBlock('````tasks\n@ハル: a\n```\n@ソラ: b')).toEqual({ lines: ['@ハル: a', '```', '@ソラ: b'], start: 0, end: 4 });
    expect(findTasksBlock('前置き\r\n```tasks\r\n@ハル: a\r\n```')?.lines).toEqual(['@ハル: a']);
  });

  it('2つ目以降の tasks ブロックは読まない', () => {
    const twice = '```tasks\n@ハル: 1\n```\n```tasks\n@ソラ: 2\n```';
    expect(findTasksBlock(twice)?.lines).toEqual(['@ハル: 1']);
  });
});

describe('removeTasksBlock', () => {
  it('ブロックを取り除き、前後の余分な空行をまとめる', () => {
    expect(removeTasksBlock(reply)).toBe('2つに分けて進めます。\n\nよろしくお願いします。');
    expect(removeTasksBlock('```tasks\n@ハル: a\n```')).toBe('');
  });

  it('tasks ブロックがなければそのまま返す', () => {
    expect(removeTasksBlock('ふつうの返答\n\n```ts\nx\n```')).toBe('ふつうの返答\n\n```ts\nx\n```');
  });
});
