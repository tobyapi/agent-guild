import { describe, expect, it } from 'vitest';
import type { Agent, AgentTemplate, Channel } from '@/shared/types/domain';
import {
  addableAgents,
  channelErrorField,
  cleanChannelName,
  memberGroups,
  resolveActiveChannel,
  validateChannelDraft,
  workingSummary,
} from './channels';

const channel = (id: string, memberIds: string[] = ['me']): Channel => ({ id, name: id, topic: '', memberIds, createdAt: 0 });

const agent = (id: string, tags: string[], deletedAt: number | null = null) => ({ id, tags, name: id, deletedAt }) as Agent;

const template = (id: string, tag: string, accent: AgentTemplate['accent']) =>
  ({ id, label: tag, accent, defaults: { tags: [tag] } }) as AgentTemplate;
const templates = [template('worker', '作業者', 'worker'), template('expert', '専門家', 'expert')];

describe('resolveActiveChannel', () => {
  it('今のチャンネルが残っていればそれ、なければ先頭', () => {
    const channels = [channel('a'), channel('b')];
    expect(resolveActiveChannel(channels, 'b')).toBe('b');
    expect(resolveActiveChannel(channels, 'gone')).toBe('a');
    expect(resolveActiveChannel([], 'a')).toBeNull();
  });
});

describe('memberGroups / addableAgents', () => {
  const agents = [
    agent('hal', ['作業者', 'リサーチ']),
    agent('logica', ['専門家']),
    agent('sora', ['作業者'], 1),
    agent('gear', ['専門家']),
    agent('memo', []),
    agent('kiroku', ['記録']),
  ];
  const lobby = channel('lobby', ['me', 'hal', 'logica', 'sora', 'memo', 'kiroku']);

  it('先頭のタグの区分で、削除されていないメンバーだけを並べる（いない区分は出さない）', () => {
    const groups = memberGroups(lobby, agents, templates);
    expect(groups.map((group) => [group.label, group.accent, group.agents.map((member) => member.id)])).toEqual([
      ['作業者', 'worker', ['hal']],
      ['専門家', 'expert', ['logica']],
      ['記録', null, ['kiroku']],
      ['タグなし', null, ['memo']],
    ]);
    expect(memberGroups(channel('empty'), agents, templates)).toEqual([]);
  });

  it('追加できるのは、削除されておらずまだいないエージェント', () => {
    expect(addableAgents(lobby, agents).map((candidate) => candidate.id)).toEqual(['gear']);
  });
});

describe('workingSummary', () => {
  it('作業中の名前と待機数をまとめる', () => {
    expect(workingSummary(['ハル'], 0)).toBe('ハル が作業中');
    expect(workingSummary(['ハル', 'ギア'], 1)).toBe('ハル、ギア が作業中 · 待機 1');
    expect(workingSummary(['ハル', 'ギア', 'ソラ'], 0)).toBe('ハル ほか 2 人が作業中');
    expect(workingSummary([], 2)).toBe('待機 2');
  });
});

describe('validateChannelDraft', () => {
  it('名前は必須（先頭の # は外して数える）', () => {
    expect(cleanChannelName('  #企画 ')).toBe('企画');
    expect(validateChannelDraft({ name: '#', topic: '', memberIds: [] })).toEqual({ name: 'チャンネル名を入力してください' });
    expect(validateChannelDraft({ name: '企画', topic: '新しい企画', memberIds: [] })).toEqual({});
    expect(cleanChannelName('＃企画')).toBe('企画');
  });

  it('名前は40文字・話題は200文字まで（サーバと同じ上限）', () => {
    expect(validateChannelDraft({ name: 'あ'.repeat(40), topic: 'い'.repeat(200), memberIds: [] })).toEqual({});
    expect(validateChannelDraft({ name: 'あ'.repeat(41), topic: 'い'.repeat(201), memberIds: [] })).toEqual({
      name: 'チャンネル名は40文字以内にしてください',
      topic: '話題は200文字以内にしてください',
    });
  });
});

describe('channelErrorField', () => {
  it('保存のエラーの field を名前・話題の入力に結びつける', () => {
    expect(channelErrorField('name')).toBe('name');
    expect(channelErrorField('topic')).toBe('topic');
    expect(channelErrorField(null)).toBeNull();
    expect(channelErrorField('memberIds')).toBeNull();
  });
});
