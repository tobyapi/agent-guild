// 初期データのスキル（§13 の2つ）と、ライブラリにリンクしたスキルの見本（読めるもの1つ・リンク先が消えたもの1つ）。
import type { Skill } from '@/shared/types/domain';
import { SEED_IDS } from './seedIds';

export function seedSkills(updatedAt: number): Skill[] {
  return [
    {
      id: 'skill-review-checklist',
      agentId: SEED_IDS.logica,
      name: 'review-checklist',
      description: '文章や企画を論理・根拠・読み手の観点でレビューするときのチェックリスト',
      body: '# レビューの手順\n\n1. 主張は1文で言えるか\n2. 根拠は主張を支えているか\n3. 反論や例外を検討しているか\n',
      source: null,
      problem: null,
      updatedAt,
    },
    {
      id: 'skill-writing-style',
      agentId: SEED_IDS.logica,
      name: 'writing-style',
      description: '社内文書の表記ゆれと文体をそろえるときのルール集',
      body: '',
      source: { kind: 'linked', path: 'D:\\skills\\writing-style' },
      problem: null,
      updatedAt,
    },
    {
      id: 'skill-code-review',
      agentId: SEED_IDS.gear,
      name: 'code-review',
      description: 'コードを保守性・凝集度・テスト容易性の観点でレビューするときの手順',
      body: '# コードレビューの観点\n\n- 1つのモジュールが1つの責務か\n- 依存の向きが内側を向いているか\n- 純粋なロジックが単体テストで固められているか\n',
      source: null,
      problem: null,
      updatedAt,
    },
    {
      id: 'skill-legacy-lint',
      agentId: SEED_IDS.gear,
      name: 'legacy-lint',
      description: '古いコードの静的解析の結果を読むときの手順',
      body: '# 手順\n\n1. 警告を種類ごとに数える\n',
      source: { kind: 'linked', path: 'D:\\skills\\legacy-lint' },
      problem: null,
      updatedAt,
    },
  ];
}
