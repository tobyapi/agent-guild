/**
 * スキルの出どころ。
 * - null: アプリ内で書いたスキル（またはライブラリ・内蔵スキルからコピーしたもの）。DB の name / description / body が正で、編集できる
 * - linked: スキルライブラリのフォルダを参照する。実行のたびに SKILL.md を読み直し、付属ファイルも含めて渡す。アプリ内では編集できない
 * - builtin: アプリに同梱した内蔵スキルを参照する。一覧と実行のたびに同梱の SKILL.md を読み直す（アプリの更新に追従）。アプリ内では編集できない
 */
export type SkillSource = LinkedSkillSource | BuiltinSkillSource;

export interface LinkedSkillSource {
  kind: 'linked';
  /** SKILL.md があるフォルダの絶対パス */
  path: string;
}

export interface BuiltinSkillSource {
  kind: 'builtin';
  /** 内蔵スキルの name */
  name: string;
}

/** アプリに同梱した内蔵スキル（list_builtin_skills。name の順） */
export interface BuiltinSkill {
  name: string;
  description: string;
  body: string;
}

export interface Skill {
  id: string;
  agentId: string;
  /** Agent Skills 標準: 64文字以内の英小文字・数字・ハイフン。エージェント内で一意 */
  name: string;
  /** 必須・1024文字以内 */
  description: string;
  /** linked・builtin のときは、取得した時点で参照先から読んだ本文 */
  body: string;
  source: SkillSource | null;
  /** linked・builtin のスキルを読めなかったときの理由（フォルダがない・SKILL.md が壊れている・この版にない など）。問題なければ null */
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

/** ライブラリ・内蔵スキルからの追加のしかた: link = 参照して実行のたびに読み直す（既定）/ copy = 取り込んでアプリ内で編集する */
export type LibraryAddMode = 'link' | 'copy';
