import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { objectOf } from '@/shared/types/schema';
import { skillLibrarySchema } from '@/shared/types/schemas/skills';
import { createHarness } from './harness.test-support';
import { SEED_IDS } from './seedIds';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('モックのスキルライブラリ', () => {
  it('get_skill_library: 指定の順に走査し、同じフォルダの中は name の順。問題と見つからないフォルダも知らせる', async () => {
    const mock = await createHarness();
    const library = await mock.transport.invoke('get_skill_library', {});
    expect(objectOf(skillLibrarySchema)(library, 'library')).toEqual([]);
    expect(library.skills.map((skill) => skill.name)).toEqual([
      'Draft Notes',
      'unity-performance',
      'writing-style',
      'a11y-check',
      'api-design',
      'incident-report',
    ]);
    expect(library.skills[0]?.problem).toBe('name が Agent Skills の形式（英小文字・数字・ハイフン）ではありません。description がありません。');
    expect(library.dirProblems).toEqual({ 'F:\\usb-skills': 'フォルダが見つかりません' });
  });

  it('set_skill_library_dirs: 相対パス・重複・入れ子は validation。保存すると skill-library-changed', async () => {
    const mock = await createHarness();
    const set = (dirs: string[]) => mock.transport.invoke('set_skill_library_dirs', { dirs });
    await expect(set(['skills'])).rejects.toMatchObject({ code: 'validation', field: 'dirs' });
    await expect(set(['D:\\skills', 'd:/skills/'])).rejects.toMatchObject({ code: 'validation' });
    await expect(set(['D:\\skills', 'D:\\skills\\sub'])).rejects.toMatchObject({ code: 'validation' });
    const library = await set(['E:\\team-skills']);
    expect(library.dirs).toEqual(['E:\\team-skills']);
    expect(library.skills.every((skill) => skill.libraryDir === 'E:\\team-skills')).toBe(true);
    await mock.settle();
    expect(mock.libraryChanges).toBe(1);
  });

  it('add_library_skill（link）: リンク先を参照し、アプリ内では編集できず、外すことはできる', async () => {
    const mock = await createHarness();
    const path = 'E:\\team-skills\\api-design';
    const linked = await mock.transport.invoke('add_library_skill', { agentId: SEED_IDS.hal, path, mode: 'link' });
    expect(linked).toMatchObject({ name: 'api-design', source: { kind: 'linked', path }, problem: null });
    const input = { id: linked.id, agentId: SEED_IDS.hal, name: 'api-design', description: '書き換え', body: '' };
    await expect(mock.transport.invoke('save_skill', { input })).rejects.toMatchObject({ code: 'validation' });
    await mock.transport.invoke('delete_skill', { id: linked.id });
    await mock.settle();
    expect(mock.skillsChanged).toEqual([SEED_IDS.hal, SEED_IDS.hal]);
  });

  it('add_library_skill（copy）: ふつうのスキルとして取り込む。同じ name は conflict、問題のあるものは validation', async () => {
    const mock = await createHarness();
    const add = (path: string, mode: 'link' | 'copy') => mock.transport.invoke('add_library_skill', { agentId: SEED_IDS.hal, path, mode });
    const copied = await add('E:\\team-skills\\incident-report', 'copy');
    expect(copied).toMatchObject({ source: null, body: expect.stringContaining('障害報告書') as unknown });
    await expect(add('E:\\team-skills\\incident-report', 'link')).rejects.toMatchObject({ code: 'conflict' });
    await expect(add('D:\\skills\\Draft Notes', 'link')).rejects.toMatchObject({ code: 'validation' });
    await expect(add('D:\\skills\\missing', 'link')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('list_skills: リンクしたスキルは元のフォルダから読み直し、読めなければ problem に理由を出す', async () => {
    const mock = await createHarness();
    const logica = await mock.transport.invoke('list_skills', { agentId: SEED_IDS.logica });
    expect(logica.find((skill) => skill.name === 'writing-style')).toMatchObject({ problem: null, body: expect.stringContaining('表記のルール') as unknown });
    const gear = await mock.transport.invoke('list_skills', { agentId: SEED_IDS.gear });
    expect(gear.find((skill) => skill.name === 'legacy-lint')?.problem).toContain('リンク先のフォルダが見つかりません');
  });

  it('reveal_skill_folder: あるフォルダは開き、ないフォルダは not_found', async () => {
    const mock = await createHarness();
    await expect(mock.transport.invoke('reveal_skill_folder', { path: 'D:\\skills' })).resolves.toBeNull();
    await expect(mock.transport.invoke('reveal_skill_folder', { path: 'D:\\skills\\legacy-lint' })).rejects.toMatchObject({ code: 'not_found' });
  });
});
