import type { BackendInfo } from '@/shared/types/domain';
import { describe, expect, it } from 'vitest';
import { newDraft } from './draft';
import type { AgentDraft } from './draft';
import { allCapabilities, BACKENDS, TEMPLATES } from './fixtures.test-support';
import { rolePermissions } from '@/shared/lib/permissionPolicy';
import { agentErrorField, validateAgentDraft } from './validation';

const ctx = { templates: TEMPLATES, backends: BACKENDS, takenNames: ['ハル', 'あなた'] };
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

  it('個別の権限は無視し、役割の固定設定で保存する', () => {
    const permissions = { ...allCapabilities, runCommands: false, writeAnywhere: false };
    const result = validateAgentDraft(draft({ backend: 'codex', permissions }), ctx);
    expect(result.ok).toBe(true);
    expect(result.ok && result.input.permissions).toEqual(allCapabilities);
    expect(validateAgentDraft(draft({ backend: 'codex', permissions: allCapabilities }), ctx).ok).toBe(true);
    const expert = newDraft(
      TEMPLATES.find((template) => template.id === 'expert'),
      BACKENDS,
      0,
    );
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

it('Ollama でも権限は役割のまま保存し、道具は明示有効化した対応モデルだけで使う', () => {
  const info: BackendInfo = {
    ...(BACKENDS[0] as BackendInfo),
    id: 'ollama',
    capabilities: allCapabilities,
    models: [{ id: 'small', label: 'small', description: '', efforts: [], defaultEffort: null, tools: true }],
    defaultModel: 'small',
    options: [{ key: 'enableTools', label: 'tools', description: '', type: 'boolean', choices: [], default: false }],
  };
  const local = { ...ctx, backends: [info] };
  const old = validateAgentDraft(draft({ backend: 'ollama', model: 'small', optionValues: {} }), local);
  // 権限は役割で決まるので、道具を有効にしていなくても変わらない（有効にするまでは、使える操作がないだけ）
  expect(old.ok && old.input.permissions).toEqual(rolePermissions(local.templates, draft({}).tags));
  expect(old.ok && old.input.backendOptions.enableTools).toBeUndefined();
  const enabled = validateAgentDraft(
    draft({ backend: 'ollama', model: 'small', optionValues: { enableTools: true } }),
    local,
  );
  expect(enabled.ok && enabled.input.permissions).toEqual(rolePermissions(local.templates, draft({}).tags));
  expect(enabled.ok && enabled.input.backendOptions.enableTools).toBe(true);
  const unsupported = validateAgentDraft(
    draft({ backend: 'ollama', model: 'unknown', optionValues: { enableTools: true } }),
    local,
  );
  expect(unsupported).toMatchObject({ ok: false, errors: { permissions: '道具に対応したモデルを選んでください' } });
});
