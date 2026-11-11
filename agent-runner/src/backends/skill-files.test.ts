import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { SkillPayload } from '../protocol.ts';
import { skillMarkdown, writeSkills } from './skill-files.ts';
import { BackendError } from './types.ts';

const temporary: string[] = [];
afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'guild-skills-'));
  temporary.push(dir);
  return dir;
};
const writeTree = (root: string, files: Record<string, string>): void => {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
};

const REVIEW: SkillPayload = {
  name: 'review-checklist',
  description: 'レビュー: 論理の穴を探す "手順"',
  body: '# 手順\n1. 主張を1文で言う',
  dir: null,
  files: [],
};

describe('skillMarkdown', () => {
  it('front matter の description は YAML として安全な形で書く', () => {
    expect(skillMarkdown(REVIEW)).toBe(
      '---\nname: review-checklist\ndescription: "レビュー: 論理の穴を探す \\"手順\\""\n---\n\n# 手順\n1. 主張を1文で言う\n',
    );
  });
});

describe('writeSkills', () => {
  it('<dir>/<name>/SKILL.md を書き、前回の内容（エージェントが足したものを含む）は消す', async () => {
    const dir = join(tempDir(), 'skills');
    writeTree(dir, { 'planted/SKILL.md': '勝手に足したスキル' });
    await writeSkills(dir, [REVIEW]);
    expect(readFileSync(join(dir, 'review-checklist', 'SKILL.md'), 'utf8')).toBe(skillMarkdown(REVIEW));
    expect(existsSync(join(dir, 'planted'))).toBe(false);
  });

  it('リンクしたスキルは付属ファイルもコピーし、SKILL.md は payload から書く', async () => {
    const library = join(tempDir(), 'unity-performance');
    writeTree(library, {
      'SKILL.md': '---\nname: unity-performance\n---\n古い本文',
      'scripts/profile.py': 'print("profile")',
      'references/gc.md': '# GC',
    });
    const linked: SkillPayload = {
      name: 'unity-performance',
      description: 'Unity',
      body: '# 新しい本文',
      dir: library,
      files: [],
    };
    const dir = join(tempDir(), 'skills');
    await writeSkills(dir, [REVIEW, linked]);
    const skillDir = join(dir, 'unity-performance');
    expect(readFileSync(join(skillDir, 'SKILL.md'), 'utf8')).toBe(skillMarkdown(linked));
    expect(readFileSync(join(skillDir, 'scripts', 'profile.py'), 'utf8')).toBe('print("profile")');
    expect(readFileSync(join(skillDir, 'references', 'gc.md'), 'utf8')).toBe('# GC');
    expect(readFileSync(join(library, 'SKILL.md'), 'utf8')).toContain('古い本文');
  });

  it('内蔵スキルの付属ファイル（files）を相対パスのとおりに書く', async () => {
    const files = [
      { path: 'references/patterns.md', content: '# パターン' },
      { path: 'notes.md', content: 'メモ' },
    ];
    const dir = join(tempDir(), 'skills');
    await writeSkills(dir, [{ ...REVIEW, files }]);
    const skillDir = join(dir, 'review-checklist');
    expect(readFileSync(join(skillDir, 'references', 'patterns.md'), 'utf8')).toBe('# パターン');
    expect(readFileSync(join(skillDir, 'notes.md'), 'utf8')).toBe('メモ');
    expect(readFileSync(join(skillDir, 'SKILL.md'), 'utf8')).toBe(skillMarkdown(REVIEW));
  });

  it.each(['../escape.md', '/abs.md', 'C:/x.md', 'a\\b.md', 'a//b.md', './a.md', 'SKILL.md', ''])(
    '付属ファイルのパスが不正（%s）なら bad_request で何も書かない',
    async (path) => {
      const dir = join(tempDir(), 'skills');
      const failure = writeSkills(dir, [{ ...REVIEW, files: [{ path, content: 'x' }] }]);
      await expect(failure).rejects.toMatchObject({ code: 'bad_request' });
      expect(existsSync(dir)).toBe(false);
    },
  );

  it('付属ファイルが上限を超えたら bad_request で、前回の展開も含めて何も書き換えない', async () => {
    const library = join(tempDir(), 'big');
    writeTree(library, { 'a.txt': '1234', 'b.txt': '5678' });
    const dir = join(tempDir(), 'skills');
    writeTree(dir, { 'previous/SKILL.md': '前回' });
    const failure = writeSkills(dir, [{ ...REVIEW, name: 'big', dir: library }], { maxFiles: 1, maxBytes: 1024 });
    await expect(failure).rejects.toMatchObject({ code: 'bad_request' });
    expect(readFileSync(join(dir, 'previous', 'SKILL.md'), 'utf8')).toBe('前回');
    expect(existsSync(join(dir, 'big'))).toBe(false);
  });

  it.each(['../escape', 'Upper', '-edge', 'a--b', 'a/b', ''])(
    '標準に合わない name（%s）は bad_request で何も書かない',
    async (name) => {
      const dir = join(tempDir(), 'skills');
      const failure = writeSkills(dir, [{ ...REVIEW, name }]);
      await expect(failure).rejects.toBeInstanceOf(BackendError);
      await expect(failure).rejects.toMatchObject({ code: 'bad_request' });
      expect(existsSync(dir)).toBe(false);
    },
  );

  it('同じ name のスキルが2つあれば bad_request', async () => {
    await expect(writeSkills(join(tempDir(), 'skills'), [REVIEW, REVIEW])).rejects.toMatchObject({
      code: 'bad_request',
    });
  });
});
