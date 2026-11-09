/**
 * スキルの出どころ。
 * - null: アプリ内で書いたスキル（またはライブラリからコピーしたもの）。DB の name / description / body が正で、編集できる
 * - linked: スキルライブラリのフォルダを参照する。実行のたびに SKILL.md を読み直し、付属ファイルも含めて渡す。アプリ内では編集できない
 */
export interface SkillSource {
  kind: 'linked';
  /** SKILL.md があるフォルダの絶対パス */
  path: string;
}

export interface Skill {
  id: string;
  agentId: string;
  /** Agent Skills 標準: 64文字以内の英小文字・数字・ハイフン。エージェント内で一意 */
  name: string;
  /** 必須・1024文字以内 */
  description: string;
  /** linked のときは、取得した時点で SKILL.md から読んだ本文 */
  body: string;
  source: SkillSource | null;
  /** linked のスキルを読めなかったときの理由（フォルダがない・SKILL.md が壊れている など）。問題なければ null */
  problem: string | null;
  updatedAt: number;
}

export interface SkillInput {
  id: string | null;
  agentId: string;
  name: string;
  description: string;
  body: string;
}

/** スキルライブラリで見つかったスキル（SKILL.md があるフォルダ1つ） */
export interface LibrarySkill {
  /** SKILL.md があるフォルダの絶対パス（追加するときの識別子） */
  path: string;
  /** 見つかったライブラリのフォルダ（設定で指定したもの） */
  libraryDir: string;
  /** SKILL.md の frontmatter の name（読めなければフォルダ名） */
  name: string;
  description: string;
  /** SKILL.md 以外の付属ファイルの数 */
  fileCount: number;
  /** そのままでは追加できない理由（name が標準に合わない・description がない など）。問題なければ null */
  problem: string | null;
}

export interface SkillLibrary {
  /** 設定で指定したライブラリのフォルダ（順序は使用者が並べた順） */
  dirs: string[];
  /** 見つかったスキル。dirs の順、同じフォルダの中では name の順 */
  skills: LibrarySkill[];
  /** フォルダごとの問題（見つからない・読めない）。キーは dirs の要素 */
  dirProblems: Record<string, string>;
}

/** ライブラリからの追加のしかた: link = 参照して実行のたびに読み直す（既定）/ copy = 取り込んでアプリ内で編集する */
export type LibraryAddMode = 'link' | 'copy';
