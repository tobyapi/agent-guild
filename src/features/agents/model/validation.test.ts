import { describe, expect, it } from 'vitest';
import { newDraft } from './draft';
import type { AgentDraft } from './draft';
import { allCapabilities, BACKENDS, TEMPLATES } from './fixtures.test-support';
import { agentErrorField, validateAgentDraft } from './validation';

const ctx = { backends: BACKENDS, takenNames: ['ハル', 'あなた'] };
const draft = (overrides: Partial<AgentDraft>): AgentDraft => ({
  ...newDraft(TEMPLATES[0], BACKENDS, 0),
  name: 'ミライ',
  backend: 'claude',
  ...overrides,
});

describe('validateAgentDraft', () => {
  it('問題がなければ AgentInput にする（前後の空白を除き、タグの重複をまとめる）', () => {
    const tags = ['作業者', ' 調査 ', 'ちょうさ', '調査'];
    const result = validateAgentDraft(draft({ name: ' ミライ ', role: ' 調査 ', tags }), ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input).toMatchObject({
        name: 'ミライ',
        role: '調査',
        autonomyIntervalMin: 60,
        unmentioned: 'answer',
      });
      expect(result.input.tags).toEqual(['作業者', '調査', 'ちょうさ']);
    }
  });

  it('推論の深さは backendOptions の effort にし、モデルで選べなければ指摘する', () => {
    const chosen = validateAgentDraft(draft({ model: 'sonnet', effort: 'max' }), ctx);
    expect(chosen.ok && chosen.input.backendOptions).toEqual({ effort: 'max' });
    expect(validateAgentDraft(draft({ effort: '' }), ctx)).toMatchObject({ ok: true, input: { backendOptions: {} } });
    const unsupported = validateAgentDraft(draft({ model: 'haiku', effort: 'max' }), ctx);
    expect(!unsupported.ok && unsupported.errors.effort).toBe('「Haiku」では推論の深さを選べません');
  });

  it('得意分野・相談相手・自発活動は誰でも持てる', () => {
    const result = validateAgentDraft(draft({ expertise: ' 設計 ', autonomyEnabled: true, consultable: true }), ctx);
    expect(result.ok && result.input).toMatchObject({ expertise: '設計', autonomyEnabled: true, consultable: true });
  });

  it('名前の重複・タグの規則・間隔の下限を項目ごとに指摘する', () => {
    const result = validateAgentDraft(draft({ name: 'はる', tags: ['#設計'], autonomyIntervalMin: '3' }), {
      ...ctx,
      takenNames: ['はる'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual({
        name: 'その名前はすでに使われています',
        tags: '「#設計」: タグに空白・#・,・@ は使えません',
        autonomyIntervalMin: '5 分以上にしてください',
      });
    }
  });

  it('固有設定の型の誤りは optionErrors に出す', () => {
    const result = validateAgentDraft(draft({ backend: 'claude', optionValues: { maxTurns: 'abc' } }), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.optionErrors).toEqual({ maxTurns: '数値を入力してください' });
  });

  it('バックエンドの権限の規則に反していれば、権限の問題として止める', () => {
    const result = validateAgentDraft(draft({ backend: 'codex' }), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.permissions).toContain('「コマンドを実行」を許可してください');
    expect(validateAgentDraft(draft({ backend: 'codex', permissions: allCapabilities }), ctx).ok).toBe(true);
    const expert = newDraft(TEMPLATES[1], BACKENDS, 0);
    expect(validateAgentDraft({ ...expert, name: 'ミライ', backend: 'codex' }, ctx).ok).toBe(true);
  });

  it('バックエンドの一覧が届いていなければ保存されていた固有設定を保つ', () => {
    const result = validateAgentDraft(draft({ backend: 'gemini', storedOptions: { a: 1 } }), ctx);
    expect(result.ok && result.input.backendOptions).toEqual({ a: 1 });
  });
});

describe('agentErrorField', () => {
  it('保存のエラーの field（CommandError.field）からどの入力のことかを決める', () => {
    expect(agentErrorField('validation', 'name')).toBe('name');
    expect(agentErrorField('validation', 'tags')).toBe('tags');
    expect(agentErrorField('validation', 'permissions')).toBe('permissions');
    expect(agentErrorField('validation', 'backendOptions')).toBeNull();
    expect(agentErrorField('validation', null)).toBeNull();
    expect(agentErrorField('conflict', 'name')).toBeNull();
  });
});
