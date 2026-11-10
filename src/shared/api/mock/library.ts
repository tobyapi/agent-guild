// モックのスキルライブラリ: ディスクの代わりの固定のフォルダと、走査・SKILL.md の読み方（docs/design.md §14 をモック用に）。
import { folderName, isInsidePath, isSamePath } from '@/shared/lib/paths';
import { isValidSkillName, SKILL_DESCRIPTION_MAX } from '@/shared/lib/skillName';
import { textLength } from '@/shared/lib/validation';
import type { LibrarySkill, Skill, SkillLibrary } from '@/shared/types/domain';
import { MOCK_CHOSEN_FOLDER } from './seedIds';

/** ディスク上の SKILL.md があるフォルダ1つ（frontmatter がなければ name・description は空） */
export interface MockSkillFolder {
  path: string;
  name: string;
  description: string;
  body: string;
  /** SKILL.md 以外の付属ファイルの数 */
  fileCount: number;
  hasFrontmatter: boolean;
}

export const MOCK_LIBRARY_DIRS = { personal: 'D:\\skills', team: 'E:\\team-skills', usb: 'F:\\usb-skills' } as const;

const folder = (path: string, name: string, description: string, fileCount: number, body: string): MockSkillFolder => ({
  path,
  name,
  description,
  body,
  fileCount,
  hasFrontmatter: true,
});

/** ディスクにあるフォルダ（F:\usb-skills は外されたドライブの想定でここにない） */
const SKILL_FOLDERS: readonly MockSkillFolder[] = [
  folder(
    'D:\\skills\\unity-performance',
    'unity-performance',
    'Unity のプロファイリング結果を読んで、描画とスクリプトのボトルネックを指摘するときの手順',
    3,
    '# 手順\n\n1. Profiler の CPU Usage を見る\n2. GC Alloc の多いフレームを探す\n',
  ),
  folder(
    'D:\\skills\\writing-style',
    'writing-style',
    '社内文書の表記ゆれと文体をそろえるときのルール集',
    1,
    '# 表記のルール\n\n- 「出来る」ではなく「できる」\n- 数字は半角\n',
  ),
  folder('D:\\skills\\Draft Notes', 'Draft Notes', '', 0, 'メモ書き'),
  folder(
    'E:\\team-skills\\api-design',
    'api-design',
    'REST API の設計をレビューするときの観点（命名・エラー・ページング）',
    2,
    '# 観点\n\n- リソース名は複数形\n- エラーは問題の詳細（RFC 9457）で返す\n',
  ),
  folder(
    'E:\\team-skills\\incident-report',
    'incident-report',
    '障害報告書を書くときのテンプレートと書き方',
    4,
    '# 障害報告書\n\n1. 概要\n2. 影響範囲\n3. 原因\n4. 再発防止\n',
  ),
  folder(
    'E:\\team-skills\\frontend\\a11y-check',
    'a11y-check',
    'Web アクセシビリティを確認するときのチェックリスト',
    0,
    '# チェックリスト\n\n- 画像に代替テキスト\n- キーボードで全操作に届く\n',
  ),
];

/** 存在するフォルダ（ライブラリに指定できる場所） */
const EXISTING_DIRS = [MOCK_LIBRARY_DIRS.personal, MOCK_LIBRARY_DIRS.team, MOCK_CHOSEN_FOLDER];

/** SKILL.md を Agent Skills の標準に照らした問題（なければ null）。Rust の guild-domain の判定をまねる */
export function skillMdProblem(skill: Pick<MockSkillFolder, 'name' | 'description' | 'hasFrontmatter'>): string | null {
  if (!skill.hasFrontmatter) return 'SKILL.md の先頭に frontmatter（--- で囲んだ name と description）がありません。';
  const problems = [
    isValidSkillName(skill.name) ? null : 'name が Agent Skills の形式（英小文字・数字・ハイフン）ではありません。',
    skill.description.trim() === '' ? 'description がありません。' : null,
    textLength(skill.description) > SKILL_DESCRIPTION_MAX
      ? `description が${SKILL_DESCRIPTION_MAX}文字を超えています。`
      : null,
  ];
  return problems.filter((problem) => problem !== null).join('') || null;
}

export function findSkillFolder(path: string): MockSkillFolder | undefined {
  return SKILL_FOLDERS.find((candidate) => isSamePath(candidate.path, path));
}

/** reveal_skill_folder で開けるか（ライブラリのフォルダかスキルのフォルダが実在する） */
export function folderExists(path: string): boolean {
  return EXISTING_DIRS.some((dir) => isSamePath(dir, path)) || findSkillFolder(path) !== undefined;
}

function toLibrarySkill(found: MockSkillFolder, libraryDir: string): LibrarySkill {
  const name = found.hasFrontmatter && found.name !== '' ? found.name : folderName(found.path);
  return {
    path: found.path,
    libraryDir,
    name,
    description: found.description,
    fileCount: found.fileCount,
    problem: skillMdProblem(found),
  };
}

/** 指定したフォルダを順に走査する（同じフォルダの中は name の順。見つからないフォルダは dirProblems に） */
export function scanLibrary(dirs: readonly string[]): SkillLibrary {
  const dirProblems: Record<string, string> = {};
  const skills = dirs.flatMap((dir) => {
    if (!EXISTING_DIRS.some((existing) => isSamePath(existing, dir))) {
      dirProblems[dir] = 'フォルダが見つかりません';
      return [];
    }
    return SKILL_FOLDERS.filter((found) => isInsidePath(found.path, dir))
      .map((found) => toLibrarySkill(found, dir))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  return { dirs: [...dirs], skills, dirProblems };
}

/** リンクしたスキルは、取得のたびに SKILL.md を読み直した値にする（読めなければ problem に理由） */
export function readLinkedSkill(skill: Skill): Skill {
  if (skill.source?.kind !== 'linked') return skill;
  const found = findSkillFolder(skill.source.path);
  if (!found) return { ...skill, problem: `リンク先のフォルダが見つかりません（${skill.source.path}）` };
  const problem = skillMdProblem(found);
  return problem
    ? { ...skill, problem }
    : { ...skill, description: found.description, body: found.body, problem: null };
}
