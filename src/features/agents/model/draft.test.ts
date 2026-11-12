import { describe, expect, it } from 'vitest';
import { autonomyChannelChoices, checkIntervalMin } from './autonomy';
import {
  applyPreset,
  applyTemplate,
  changeBackend,
  changeModel,
  draftFromAgent,
  newDraft,
  putHeadTag,
  changeRole,
} from './draft';
import { agentFixture, BACKENDS, TEMPLATES } from './fixtures.test-support';
import { personalities } from './personas/personalities';
import { findPreset } from './personas/presetText';
import { tones } from './personas/tones';
import { agentPresets, presetPersona, presetsFor } from './presets';

const worker = TEMPLATES.find((template) => template.id === 'worker');
const expert = TEMPLATES.find((template) => template.id === 'expert');
const agent = agentFixture({ model: 'opus', backendOptions: { maxTurns: 12, unknown: 'x' }, autonomyIntervalMin: 30 });

describe('newDraft / draftFromAgent', () => {
  it('新規は準備のできている最初のバックエンドを選び、テンプレートの既定値を入れる', () => {
    const draft = newDraft(expert, BACKENDS, 0);
    expect(draft.backend).toBe('codex');
    expect(draft).toMatchObject({
      tags: ['専門家'],
      unmentioned: 'fallback',
      consultable: true,
      autonomyEnabled: false,
    });
    expect(draft.permissions).toEqual(expert?.defaults.permissions);
    expect(newDraft(worker, [], 0).backend).toBe('');
  });

  it('テンプレートがなければ何も許さない白紙から始める', () => {
    const draft = newDraft(undefined, BACKENDS, 0);
    expect(draft.tags).toEqual([]);
    expect(Object.values(draft.permissions).some(Boolean)).toBe(false);
  });

  it('保存されている値を入力値にする（固有設定はスキーマにあるものだけ）', () => {
    const draft = draftFromAgent(agent, BACKENDS);
    expect(draft.optionValues).toEqual({ maxTurns: '12' });
    expect(draft.storedOptions).toEqual(agent.backendOptions);
    expect(draft.effort).toBe('');
    expect(draftFromAgent(agentFixture({ backendOptions: { effort: 'high' } }), BACKENDS).effort).toBe('high');
    expect(draft.autonomyIntervalMin).toBe('30');
    expect(draft).toMatchObject({ tags: agent.tags, unmentioned: 'answer', consultable: false });
  });
});

describe('変更', () => {
  const draft = draftFromAgent(agent, BACKENDS);

  it('テンプレートを選ぶと、タグ・担当・得意分野・権限・振る舞い・自発活動を一括で入れ替える（入力済みでも上書き）', () => {
    const changed = applyTemplate({ ...draft, role: '実装', expertise: 'Rust', personality: '寡黙' }, expert);
    expect(changed).toMatchObject({
      role: expert?.defaults.role,
      expertise: '',
      tags: ['専門家'],
      unmentioned: 'fallback',
    });
    expect(changed).toMatchObject({ consultable: true, canDelegate: false, personality: '寡黙', name: draft.name });
    expect(changed.permissions).toEqual(expert?.defaults.permissions);
    changed.tags.push('変更');
    changed.permissions.readFiles = false;
    expect(expert?.defaults.tags).toEqual(['専門家']);
    expect(expert?.defaults.permissions.readFiles).toBe(true);
  });

  it('割り振れる（canDelegate）テンプレートなら、その設定も入る', () => {
    if (!expert) throw new Error('テンプレートがありません');
    const manager = {
      ...expert,
      id: 'manager',
      defaults: { ...expert.defaults, unmentioned: 'lead' as const, canDelegate: true, role: '割り振る' },
    };
    expect(applyTemplate(draft, manager)).toMatchObject({ unmentioned: 'lead', canDelegate: true, role: '割り振る' });
  });

  it('サイドバーの区画の「＋」から来たら、その区画のタグを先頭に入れる（同じタグは先頭へ移す）', () => {
    expect(putHeadTag({ ...draft, tags: ['作業者'] }, '実装').tags).toEqual(['実装', '作業者']);
    expect(putHeadTag({ ...draft, tags: ['作業者', 'Review'] }, 'review').tags).toEqual(['review', '作業者']);
  });

  it('人格の例は人格だけを流し込み、性格・口調はプリセットの表の文面を引く', () => {
    const [preset] = presetsFor('expert');
    if (!preset) throw new Error('専門家の人格の例がありません');
    const applied = applyPreset(draft, preset);
    expect(applied).toMatchObject({ name: preset.values.name, expertise: preset.values.expertise, tags: draft.tags });
    expect(applied.personality).toBe(findPreset(personalities(), preset.values.personality)?.text);
    expect(applied.tone).toBe(findPreset(tones(), preset.values.tone)?.text);
  });

  it('人格の例の性格・口調は、どれもプリセットの表にある', () => {
    for (const candidate of agentPresets()) {
      expect(presetPersona(candidate.values).personality, candidate.id).not.toBe('');
      expect(presetPersona(candidate.values).tone, candidate.id).not.toBe('');
    }
  });

  it('人格の例はテンプレートごとに引く', () => {
    expect(presetsFor('worker').every((preset) => preset.templateId === 'worker')).toBe(true);
    expect(presetsFor('unknown')).toEqual([]);
  });

  it('人格の例は4役のいずれかに属し、調査・記録・利用者目線も選べる', () => {
    for (const preset of agentPresets())
      expect(TEMPLATES.some((template) => template.id === preset.templateId)).toBe(true);
    expect(presetsFor('worker').map((preset) => preset.id)).toEqual(
      expect.arrayContaining(['web-researcher', 'minutes']),
    );
    expect(presetsFor('expert').map((preset) => preset.id)).toEqual(
      expect.arrayContaining(['devils-advocate', 'first-timer']),
    );
    expect(presetsFor('ideator').map((preset) => preset.id)).toEqual(['idea-maker', 'new-angle']);
  });

  it('バックエンドを変えるとモデル・推論の深さ・固有設定を既定に戻す', () => {
    const changed = changeBackend({ ...draft, effort: 'high' }, 'codex');
    expect(changed).toMatchObject({ backend: 'codex', model: '', effort: '', optionValues: {} });
    expect(changeBackend(draft, draft.backend)).toBe(draft);
  });

  it('モデルを変えると、そのモデルで選べない推論の深さだけを既定に戻す', () => {
    const high = { ...draft, model: '', effort: 'high' };
    expect(changeModel(high, 'sonnet', BACKENDS[0])).toMatchObject({ model: 'sonnet', effort: 'high' });
    expect(changeModel(high, 'haiku', BACKENDS[0])).toMatchObject({ model: 'haiku', effort: '' });
    expect(changeModel(high, 'my-model', BACKENDS[0]).effort).toBe('high');
  });

  it('役割変更では人格・モデル・追加タグを保ち、権限と応答方法を切り替える', () => {
    if (!expert) throw new Error('専門家がありません');
    const changed = changeRole(
      { ...draft, tags: ['作業者', '設計'], model: 'opus', personality: '丁寧' },
      expert,
      TEMPLATES,
    );
    expect(changed).toMatchObject({
      tags: ['専門家', '設計'],
      model: 'opus',
      personality: '丁寧',
      consultable: true,
      unmentioned: 'fallback',
    });
    expect(changed.permissions).toEqual(expert.defaults.permissions);
  });
});

describe('autonomy', () => {
  it('投稿先の候補は参加しているチャンネルだけ（新規はなし）', () => {
    const channels = [
      { id: 'c1', name: 'ロビー', memberIds: ['me', 'a1'] },
      { id: 'c2', name: '雑談', memberIds: ['me'] },
    ];
    expect(autonomyChannelChoices(channels, 'a1')).toEqual([{ id: 'c1', name: 'ロビー' }]);
    expect(autonomyChannelChoices(channels, null)).toEqual([]);
  });

  it('間隔は 5 分以上の整数', () => {
    expect(checkIntervalMin('60')).toBeNull();
    expect(checkIntervalMin('4')).toBe('5 分以上にしてください');
    expect(checkIntervalMin('1.5')).toBe('分の数を入力してください');
  });
});
