import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { arrayOf, objectOf } from '@/shared/types/schema';
import { builtinSkillSchema } from '@/shared/types/schemas/skills';
import { createHarness } from './harness.test-support';
import { SEED_IDS } from './seedIds';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('モックの内蔵スキル', () => {
  it('list_builtin_skills: 同梱の SKILL.md を name の順に返す', async () => {
    const mock = await createHarness();
    const builtins = await mock.transport.invoke('list_builtin_skills', {});
    expect(arrayOf(objectOf(builtinSkillSchema))(builtins, 'builtins')).toEqual([]);
    const names = builtins.map((skill) => skill.name);
    expect(names).toEqual([...names].sort());
    expect(names).toContain('code-review');
    expect(builtins.every((skill) => skill.description !== '' && !skill.body.startsWith('---'))).toBe(true);
    expect(builtins.every((skill) => !skill.description.startsWith('"') && !skill.description.startsWith("'"))).toBe(
      true,
    );
    const critique = builtins.find((skill) => skill.name === 'universal-critique');
    expect(critique?.files).toContain('references/classical-methods.md');
    expect(builtins.find((skill) => skill.name === 'code-review')?.files).toEqual([]);
  });

  it('add_builtin_skill（link）: 内蔵スキルを参照し、編集はできず、一覧では同梱の内容を読み直す', async () => {
    const mock = await createHarness();
    const add = (name: string, mode: 'link' | 'copy') =>
      mock.transport.invoke('add_builtin_skill', { agentId: SEED_IDS.hal, name, mode });
    const linked = await add('code-review', 'link');
    expect(linked).toMatchObject({ source: { kind: 'builtin', name: 'code-review' }, problem: null });
    const input = { id: linked.id, agentId: SEED_IDS.hal, name: 'code-review', description: '書き換え', body: '' };
    await expect(mock.transport.invoke('save_skill', { input })).rejects.toMatchObject({ code: 'validation' });
    await expect(add('code-review', 'copy')).rejects.toMatchObject({ code: 'conflict' });
    await expect(add('no-such-skill', 'link')).rejects.toMatchObject({ code: 'not_found' });
    const listed = await mock.transport.invoke('list_skills', { agentId: SEED_IDS.hal });
    expect(listed.find((skill) => skill.id === linked.id)?.body).toContain('コードレビュー');
  });

  it('add_builtin_skill（copy）: ふつうのスキルとして取り込み、編集できる', async () => {
    const mock = await createHarness();
    const copied = await mock.transport.invoke('add_builtin_skill', {
      agentId: SEED_IDS.hal,
      name: 'proofreading',
      mode: 'copy',
    });
    expect(copied.source).toBeNull();
    const input = { id: copied.id, agentId: SEED_IDS.hal, name: 'proofreading', description: '自分用', body: '' };
    expect(await mock.transport.invoke('save_skill', { input })).toMatchObject({ description: '自分用' });
    await mock.settle();
    expect(mock.skillsChanged).toEqual([SEED_IDS.hal, SEED_IDS.hal]);
  });
});
