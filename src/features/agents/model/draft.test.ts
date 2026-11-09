import { describe, expect, it } from 'vitest';
import { autonomyChannelChoices, checkIntervalMin } from './autonomy';
import { applyPreset, applyTemplate, changeBackend, draftFromAgent, newDraft, putHeadTag, setPermission } from './draft';
import { agentFixture, BACKENDS, TEMPLATES } from './fixtures.test-support';
import { PERSONALITIES } from './personas/personalities';
import { findPreset } from './personas/presetText';
import { TONES } from './personas/tones';
import { AGENT_PRESETS, presetPersona, presetsFor } from './presets';

const [worker, expert] = TEMPLATES;
const agent = agentFixture({ model: 'opus', backendOptions: { maxTurns: 12, unknown: 'x' }, autonomyIntervalMin: 30 });

describe('newDraft / draftFromAgent', () => {
  it('新規は準備のできている最初のバックエンドを選び、テンプレートの既定値を入れる', () => {
    const draft = newDraft(expert, BACKENDS, 0);
    expect(draft.backend).toBe('codex');
    expect(draft).toMatchObject({ tags: ['専門家'], unmentioned: 'fallback', consultable: true, autonomyEnabled: false });
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
    expect(draft.autonomyIntervalMin).toBe('30');
    expect(draft).toMatchObject({ tags: agent.tags, unmentioned: 'answer', consultable: false });
  });
});

describe('変更', () => {
  const draft = draftFromAgent(agent, BACKENDS);

  it('テンプレートを選ぶと、タグ・担当・得意分野・権限・振る舞い・自発活動を一括で入れ替える（入力済みでも上書き）', () => {
    const changed = applyTemplate({ ...draft, role: '実装', expertise: 'Rust', personality: '寡黙' }, expert);
    expect(changed).toMatchObject({ role: '専門分野の相談とレビューに答える', expertise: '', tags: ['専門家'], unmentioned: 'fallback' });
    expect(changed).toMatchObject({ consultable: true, canDelegate: false, personality: '寡黙', name: draft.name });
    expect(changed.permissions.writeFiles).toBe(false);
    changed.tags.push('変更');
    changed.permissions.readFiles = false;
    expect(expert?.defaults.tags).toEqual(['専門家']);
    expect(expert?.defaults.permissions.readFiles).toBe(true);
  });

  it('割り振れる（canDelegate）テンプレートなら、その設定も入る', () => {
    if (!expert) throw new Error('テンプレートがありません');
    const manager = { ...expert, id: 'manager', defaults: { ...expert.defaults, unmentioned: 'lead' as const, canDelegate: true, role: '割り振る' } };
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
    expect(applied.personality).toBe(findPreset(PERSONALITIES, preset.values.personality)?.text);
    expect(applied.tone).toBe(findPreset(TONES, preset.values.tone)?.text);
  });

  it('人格の例の性格・口調は、どれもプリセットの表にある', () => {
    for (const candidate of AGENT_PRESETS) {
      expect(presetPersona(candidate.values).personality, candidate.id).not.toBe('');
      expect(presetPersona(candidate.values).tone, candidate.id).not.toBe('');
    }
  });

  it('人格の例はテンプレートごとに引く', () => {
    expect(presetsFor('worker').every((preset) => preset.templateId === 'worker')).toBe(true);
    expect(presetsFor('unknown')).toEqual([]);
  });

  it('バックエンドを変えるとモデルと固有設定を既定に戻す', () => {
    expect(changeBackend(draft, 'codex')).toMatchObject({ backend: 'codex', model: '', optionValues: {} });
    expect(changeBackend(draft, draft.backend)).toBe(draft);
  });

  it('権限を1つずつ付け外しする', () => {
    expect(setPermission(draft, 'runCommands', true).permissions.runCommands).toBe(true);
    expect(setPermission(draft, 'webSearch', false).permissions).toMatchObject({ webSearch: false, webFetch: true });
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
