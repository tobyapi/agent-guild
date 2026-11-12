// run に添える中身（スキルと画像）の形。protocol.ts の一部（同じ内部契約）で、protocol.ts から再輸出する。

export interface SkillPayload {
  name: string;
  description: string;
  /** SKILL.md の本文（frontmatter を除く）。アダプタはこれと name / description から SKILL.md を書く */
  body: string;
  /** ライブラリにリンクしたスキルのフォルダ（絶対パス。null ならアプリ内）。アダプタは SKILL.md 以外の付属ファイル（scripts/ など）も
   * 展開先へコピーする（SKILL.md・.git・node_modules・シンボリックリンクは除く。合計 50MB・2000 ファイルまで。超えたら error{bad_request}） */
  dir: string | null;
  /** 内蔵スキルの付属ファイル（中身ごと渡す。ほかのスキルは []）。アダプタは展開先の <name>/<path> に書く。path は / 区切りの相対パスで、
   * 絶対パス・..・SKILL.md は不正（error{bad_request}）。dir の付属ファイルと同じ上限に数える */
  files: SkillFilePayload[];
}

export interface SkillFilePayload {
  /** スキルのフォルダからの相対パス（/ 区切り） */
  path: string;
  /** UTF-8 のテキスト */
  content: string;
}

/** run に添える画像（会話に貼られたもの）。アダプタは SDK の画像入力として渡す */
export interface ImagePayload {
  /** 画像ファイルの絶対パス（データフォルダの attachments/ の中。エージェントの読み取り権限とは関係なく読む） */
  path: string;
  /** image/png・image/jpeg・image/gif・image/webp のどれか */
  mediaType: string;
}
