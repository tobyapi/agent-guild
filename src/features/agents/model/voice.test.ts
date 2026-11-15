import { describe, expect, it } from 'vitest';
import { changeRole, draftFromAgent, newDraft } from './draft';
import { agentFixture, BACKENDS, TEMPLATES } from './fixtures.test-support';
import { validateAgentDraft } from './validation';

const context = { backends: BACKENDS, templates: TEMPLATES, takenNames: [] };

describe('会話文体の保存', () => {
  it('新規は自動・弱で、人格と別に強度を保存できる', () => {
    expect(newDraft(TEMPLATES[0], BACKENDS, 0).voice).toEqual({ mode: 'auto', intensity: 'weak' });
    const agent = agentFixture({ personality: '控えめ', tone: '私・丁寧語' });
    const draft = draftFromAgent(agent, BACKENDS);
    const result = validateAgentDraft({ ...draft, voice: { mode: 'auto', intensity: 'medium' } }, context);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Valid voice setting was rejected');
    expect(result.input).toMatchObject({
      personality: '控えめ',
      tone: '私・丁寧語',
      voice: { mode: 'auto', intensity: 'medium' },
    });
    expect(draftFromAgent({ ...agent, ...result.input }, BACKENDS).voice).toEqual(result.input.voice);
  });
  it('旧番号は入力として拒否し、読み込み時には自動へ移す', () => {
    const draft = draftFromAgent(agentFixture(), BACKENDS);
    const invalid = validateAgentDraft({ ...draft, voice: { mode: '061', intensity: 'weak' } }, context);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.errors.voice).toBeTruthy();
    expect(draftFromAgent(agentFixture({ voice: { mode: '045', intensity: 'strong' } }), BACKENDS).voice).toEqual({
      mode: 'auto',
      intensity: 'strong',
    });
    const valid = validateAgentDraft({ ...draft, voice: { mode: 'auto', intensity: 'weak' } }, context);
    expect(valid.ok).toBe(true);
  });
  it('役割を変えても文体設定を維持する', () => {
    const draft = draftFromAgent(agentFixture({ voice: { mode: 'off', intensity: 'strong' } }), BACKENDS);
    const template = TEMPLATES[1];
    if (!template) throw new Error('Missing test template');
    expect(changeRole(draft, template, TEMPLATES).voice).toEqual(draft.voice);
  });
});
