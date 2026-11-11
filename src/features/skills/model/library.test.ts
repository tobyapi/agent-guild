import { describe, expect, it } from 'vitest';
import type { BuiltinSkill, LibrarySkill, Skill, SkillLibrary } from '@/shared/types/domain';
import { builtinEntryState, checkNewDir, libraryEntryState, moveItem, searchLibrary, skillCountIn } from './library';

const entry = (name: string, overrides: Partial<LibrarySkill> = {}): LibrarySkill => ({
  path: `D:\\skills\\${name}`,
  libraryDir: 'D:\\skills',
  name,
  description: `${name} の説明`,
  fileCount: 0,
  problem: null,
  ...overrides,
});

const skill = (name: string, linkedPath: string | null = null): Skill => ({
  id: name,
  agentId: 'a',
  name,
  description: '',
  body: '',
  source: linkedPath === null ? null : { kind: 'linked', path: linkedPath },
  problem: null,
  updatedAt: 0,
});

describe('builtinEntryState', () => {
  const builtin: BuiltinSkill = { name: 'code-review', description: 'レビュー', body: '', files: [] };
  const referencing: Skill = { ...skill('code-review'), source: { kind: 'builtin', name: 'code-review' } };

  it('同じ内蔵スキルを参照済みなら追加済み、同じ名前の別のスキルがあれば追加できない', () => {
    expect(builtinEntryState(builtin, [referencing])).toEqual({ kind: 'added' });
    expect(builtinEntryState(builtin, [skill('code-review')])).toEqual({ kind: 'nameTaken' });
    expect(builtinEntryState(builtin, [skill('code-review', 'D:\\skills\\code-review')])).toEqual({
      kind: 'nameTaken',
    });
    expect(builtinEntryState(builtin, [skill('other')])).toEqual({ kind: 'available' });
  });
});

describe('libraryEntryState', () => {
  it('同じフォルダのリンクは追加済み（大文字小文字・区切りの違いは同じとみなす）', () => {
    expect(libraryEntryState(entry('api-design'), [skill('api-design', 'd:/skills/api-design')])).toEqual({
      kind: 'added',
    });
  });

  it('問題があれば理由を返し、同じ名前のスキルがあれば追加できない', () => {
    expect(libraryEntryState(entry('Bad', { problem: 'description がありません。' }), [])).toEqual({
      kind: 'problem',
      reason: 'description がありません。',
    });
    expect(libraryEntryState(entry('api-design'), [skill('api-design')])).toEqual({ kind: 'nameTaken' });
    expect(libraryEntryState(entry('api-design'), [skill('api-design', 'E:\\other\\api-design')])).toEqual({
      kind: 'nameTaken',
    });
    expect(libraryEntryState(entry('api-design'), [skill('other')])).toEqual({ kind: 'available' });
  });
});

describe('searchLibrary', () => {
  const skills = [
    entry('api-design', { description: 'REST API の設計' }),
    entry('incident-report', { description: '障害報告書' }),
  ];

  it('空白で区切った語をすべて含むものを、大文字小文字や全角半角を無視して探す', () => {
    expect(searchLibrary(skills, 'ＲＥＳＴ 設計').map((found) => found.name)).toEqual(['api-design']);
    expect(searchLibrary(skills, 'report').map((found) => found.name)).toEqual(['incident-report']);
    expect(searchLibrary(skills, '  ')).toHaveLength(2);
    expect(searchLibrary(skills, 'unity')).toEqual([]);
  });
});

describe('skillCountIn / moveItem', () => {
  it('フォルダごとの数を数える', () => {
    const library: SkillLibrary = { dirs: ['D:\\skills', 'E:\\x'], skills: [entry('a'), entry('b')], dirProblems: {} };
    expect(skillCountIn(library, 'D:\\skills')).toBe(2);
    expect(skillCountIn(library, 'E:\\x')).toBe(0);
  });

  it('上下に動かし、端を越えるなら変えない', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('checkNewDir', () => {
  const dirs = ['D:\\skills', 'E:\\team\\skills'];

  it('同じフォルダ・入れ子を断る', () => {
    expect(checkNewDir(dirs, 'd:/skills/')).toBe('そのフォルダはすでに指定されています');
    expect(checkNewDir(dirs, 'D:\\skills\\sub')).toContain('D:\\skills の中のフォルダです');
    expect(checkNewDir(dirs, 'E:\\team')).toContain('先に E:\\team\\skills を外してください');
    expect(checkNewDir(dirs, 'F:\\skills')).toBeNull();
  });
});
