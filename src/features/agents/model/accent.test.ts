import { describe, expect, it } from 'vitest';
import type { AgentTemplate } from '@/shared/types/domain';
import { agentAccent, primaryTag, tagAccent } from './accent';
import { agentFixture, TEMPLATES } from './fixtures.test-support';
import { groupByPrimaryTag, untaggedLabel } from './groups';

describe('tagAccent / agentAccent', () => {
  it('タグを先頭に持つテンプレートの accent（NFKC＋大文字小文字無視で照合）', () => {
    expect(tagAccent(TEMPLATES, '作業者')).toBe('worker');
    expect(tagAccent(TEMPLATES, ' 専門家 ')).toBe('expert');
    expect(tagAccent(TEMPLATES, 'リサーチ')).toBeNull();
    expect(tagAccent(TEMPLATES, null)).toBeNull();
  });

  it('accent が null のテンプレートや、先頭以外のタグの一致は中立', () => {
    const base = TEMPLATES[0];
    if (!base) throw new Error('テンプレートがありません');
    const neutral: AgentTemplate[] = [
      { ...base, accent: null, defaults: { ...base.defaults, tags: ['Draft', '作業者'] } },
    ];
    expect(tagAccent(neutral, 'draft')).toBeNull();
    expect(tagAccent(neutral, '作業者')).toBeNull();
  });

  it('エージェントの色は先頭のタグで決まる', () => {
    expect(agentAccent(TEMPLATES, agentFixture({ tags: ['専門家', '作業者'] }))).toBe('expert');
    expect(agentAccent(TEMPLATES, agentFixture({ tags: ['実装', '作業者'] }))).toBeNull();
    expect(primaryTag(agentFixture({ tags: [] }))).toBeNull();
  });
});

describe('groupByPrimaryTag', () => {
  const agents = [
    agentFixture({ id: 'a', tags: ['設計'] }),
    agentFixture({ id: 'b', tags: ['専門家', 'レビュー'] }),
    agentFixture({ id: 'c', tags: [] }),
    agentFixture({ id: 'd', tags: ['Review'] }),
    agentFixture({ id: 'e', tags: ['あんない'] }),
    agentFixture({ id: 'f', tags: ['review'] }),
  ];
  const summary = () =>
    groupByPrimaryTag(agents, TEMPLATES).map((group) => [
      group.label,
      group.accent,
      group.agents.map((agent) => agent.id),
    ]);

  it('エージェントのいる区分だけを、テンプレートの順 → ほかのタグは日本語の照合順（英字 → かな → 漢字）→ タグなし の順に。同じタグ（正規化）はまとめる', () => {
    expect(summary()).toEqual([
      ['専門家', 'expert', ['b']],
      ['Review', null, ['d', 'f']],
      ['あんない', null, ['e']],
      ['設計', null, ['a']],
      [untaggedLabel(), null, ['c']],
    ]);
  });

  it('テンプレートの区分は「＋」で作るテンプレートを持ち、ほかのタグとタグなしは持たない', () => {
    expect(groupByPrimaryTag(agents, TEMPLATES).map((group) => group.template?.id ?? null)).toEqual([
      'expert',
      null,
      null,
      null,
      null,
    ]);
    expect(groupByPrimaryTag([], TEMPLATES)).toEqual([]);
  });

  it('役割のタグは、どの言語の表示名で付いていても同じ役割の区分と色になる', () => {
    const mixed = [agentFixture({ id: 'j', tags: ['専門家'] }), agentFixture({ id: 'k', tags: ['Expert'] })];
    expect(
      groupByPrimaryTag(mixed, TEMPLATES).map((group) => [group.label, group.accent, group.agents.length]),
    ).toEqual([['専門家', 'expert', 2]]);
    expect(tagAccent(TEMPLATES, '전문가')).toBe('expert');
  });
});
