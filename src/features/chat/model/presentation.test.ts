import { describe, expect, it } from 'vitest';
import type { Agent } from '@/shared/types/domain';
import { activityPhrase, describeActivity, splitVisible } from './activity';
import { createAuthorResolver } from './authors';
import { noticeIcon, splitLeadingName } from './systemNotice';

describe('activityPhrase / describeActivity', () => {
  it('考え中・書いています などはそのまま「が」をつなぐ', () => {
    expect(describeActivity('ハル', '考え中…')).toBe('ハル が考え中…');
    expect(describeActivity('ハル', '書いています…')).toBe('ハル が書いています…');
  });

  it('「名詞: 〜」は「名詞中: 〜」にし、英数字で始まるときは半角スペースを挟む', () => {
    expect(describeActivity('ハル', 'Web検索: Unity URP')).toBe('ハル が Web検索中: Unity URP');
    expect(activityPhrase('スキルを参照: code-review')).toBe('がスキルを参照中: code-review');
    expect(activityPhrase('コマンド実行: npm test')).toBe('がコマンド実行中: npm test');
  });

  it('「〜しています: 〜」はそのまま', () => {
    expect(describeActivity('ハル', 'ページを読んでいます: https://example.com/')).toBe(
      'ハル がページを読んでいます: https://example.com/',
    );
  });
});

describe('splitVisible', () => {
  it('2 人までは全員、3 人以上は 2 人と残りの人数', () => {
    expect(splitVisible(['a', 'b'])).toEqual({ visible: ['a', 'b'], hidden: 0 });
    expect(splitVisible(['a', 'b', 'c', 'd'])).toEqual({ visible: ['a', 'b'], hidden: 2 });
  });
});

describe('noticeIcon / splitLeadingName', () => {
  it('決まった言い回しからアイコンを選び、知らない文面は other', () => {
    expect(noticeIcon('ロジカ がチャンネルに参加しました')).toBe('join');
    expect(noticeIcon('停止しました')).toBe('stop');
    expect(noticeIcon('AI 同士の往復が上限に達したので止めました。続けるにはメンションしてください。')).toBe('limit');
    expect(noticeIcon('ようこそ')).toBe('other');
  });

  it('先頭の名前を強調できるように分ける（長い名前を優先）', () => {
    expect(splitLeadingName('ハルカ がチャンネルに参加しました', ['ハル', 'ハルカ'])).toEqual({
      name: 'ハルカ',
      rest: ' がチャンネルに参加しました',
    });
    expect(splitLeadingName('停止しました', ['ハル'])).toBeNull();
  });
});

describe('createAuthorResolver', () => {
  const agents = [
    { id: 'hal', name: 'ハル', avatar: '🌱', color: '#cb9d2a', tags: ['作業者', 'リサーチ'], backend: 'claude', deletedAt: null },
    { id: 'sora', name: 'ソラ', avatar: '🛠️', color: '#22b5e1', tags: ['作業者'], backend: 'codex', deletedAt: 1 },
  ] as Agent[];
  const resolve = createAuthorResolver(agents, { name: 'あなた', avatar: '🙂', color: '#f0ba5f' });

  it('人間・エージェント・削除済み・不明を見分ける', () => {
    expect(resolve('me')).toMatchObject({ name: 'あなた', tag: null, human: true });
    expect(resolve('hal')).toMatchObject({ name: 'ハル', tag: '作業者', backend: 'claude', deleted: false });
    expect(resolve('sora')).toMatchObject({ name: 'ソラ', tag: null, backend: null, deleted: true });
    expect(resolve('ghost')).toMatchObject({ deleted: true, tag: null });
  });
});
