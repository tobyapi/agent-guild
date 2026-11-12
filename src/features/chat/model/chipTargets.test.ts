import { describe, expect, it } from 'vitest';
import { HUMAN_ID } from '@/shared/types/domain';
import type { Agent, AgentTemplate } from '@/shared/types/domain';
import { mentionChipTargets } from './chipTargets';

const agent = (id: string, name: string, tags: string[], deletedAt: number | null = null) =>
  ({ id, name, tags, deletedAt }) as Agent;

const templates = [
  { id: 'worker', accent: 'worker', roleTags: ['作業者', 'Worker'], defaults: { tags: ['作業者'] } },
  { id: 'expert', accent: 'expert', roleTags: ['専門家', 'Expert'], defaults: { tags: ['専門家'] } },
  { id: 'plain', accent: null, roleTags: ['記録'], defaults: { tags: ['記録'] } },
] as AgentTemplate[];

describe('mentionChipTargets', () => {
  it('エージェントは先頭のタグに一致するテンプレートの accent、決まらなければ null（中立）、自分は human', () => {
    const agents = [
      agent('hal', 'ハル', ['作業者', '専門家']),
      agent('logica', 'ロジカ', ['レビュー', '専門家']),
      agent('memo', 'メモ', ['記録']),
      agent('blank', 'ブランク', []),
    ];
    expect(mentionChipTargets(agents, templates, { name: 'ユーザー' })).toEqual([
      { id: 'hal', name: 'ハル', kind: 'agent', accent: 'worker' },
      { id: 'logica', name: 'ロジカ', kind: 'agent', accent: null },
      { id: 'memo', name: 'メモ', kind: 'agent', accent: null },
      { id: 'blank', name: 'ブランク', kind: 'agent', accent: null },
      { id: HUMAN_ID, name: 'ユーザー', kind: 'human', accent: 'human' },
    ]);
  });

  it('削除済みは既定の色。同じ名前の現役か自分がいれば、削除済みはチップにしない', () => {
    const agents = [agent('old', 'ソラ', ['作業者'], 1), agent('new', 'ｿﾗ', ['専門家']), agent('gone', 'ギア', [], 2)];
    expect(mentionChipTargets(agents, templates, { name: 'ギア' }).map((target) => [target.id, target.accent])).toEqual(
      [
        ['new', 'expert'],
        [HUMAN_ID, 'human'],
      ],
    );
    expect(mentionChipTargets([agent('gone', 'ギア', [], 2)], templates, { name: 'ユーザー' })).toContainEqual({
      id: 'gone',
      name: 'ギア',
      kind: 'deleted',
      accent: null,
    });
  });
});
