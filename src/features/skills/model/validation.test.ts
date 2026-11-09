import { describe, expect, it } from 'vitest';
import type { Skill } from '@/shared/types/domain';
import { skillErrorField, validateSkillDraft } from './validation';

const existing: Skill[] = [
  { id: 's1', agentId: 'a', name: 'code-review', description: '説明', body: '', source: null, problem: null, updatedAt: 0 },
];

describe('validateSkillDraft', () => {
  it('正しい入力なら空', () => {
    expect(validateSkillDraft({ name: 'tone-check', description: '口調を見る', body: '' }, existing, null)).toEqual({});
  });

  it('名前の形を変換せずに指摘し、説明の空欄も指摘する', () => {
    const errors = validateSkillDraft({ name: 'Tone Check', description: ' ', body: '' }, existing, null);
    expect(errors.name).toContain('英小文字・数字・ハイフン');
    expect(errors.description).toBe('説明を入力してください');
  });

  it('同じエージェントの別のスキルと名前が重なれば指摘する（自分自身は除く）', () => {
    const draft = { name: 'code-review', description: '説明', body: '' };
    expect(validateSkillDraft(draft, existing, null).name).toBe('その名前のスキルはすでにあります');
    expect(validateSkillDraft(draft, existing, 's1')).toEqual({});
  });
});

describe('skillErrorField', () => {
  it('保存のエラーをどの入力のことか見分ける', () => {
    expect(skillErrorField('conflict', null)).toBe('name');
    expect(skillErrorField('validation', 'description')).toBe('description');
    expect(skillErrorField('validation', 'name')).toBe('name');
    expect(skillErrorField('validation', null)).toBeNull();
    expect(skillErrorField('internal', 'name')).toBeNull();
  });
});
