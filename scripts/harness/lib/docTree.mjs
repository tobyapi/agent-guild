// 文書（docs/architecture.md）の構成図に書かれたパスを取り出す。図と実際の構成がずれたら気づけるようにする。
// 構成図は ``` で囲んだ木で、最初の行が「ルートのパス/」。子は2つの空白ずつ字下げする。
// 1行に名前をいくつか並べてよい（区切りは空白か「, 」）。名前のあとの説明と、説明の続きの行は読まない。
// 子は、その行の最初の名前の下にあるものとして扱う。

const SEGMENT = '[A-Za-z0-9._-]+';
const NAME = new RegExp(`^${SEGMENT}(/${SEGMENT})*/?$`);
const ROOT = new RegExp(`^${SEGMENT}(/${SEGMENT})*/$`);

/** ファイル名かフォルダ名に見える語か（フォルダは / で終わり、ファイルは拡張子を持つ） */
const isName = (token) => NAME.test(token) && (token.endsWith('/') || token.includes('.'));

/** 行の先頭に並んだ名前（説明の手前まで） */
function namesOf(text) {
  const names = [];
  for (const token of text.split(/[\s,]+/)) {
    if (!isName(token)) break;
    names.push(token);
  }
  return names;
}

/** 1つの構成図（``` の中身）に書かれたパス。構成図でなければ空 */
function pathsInBlock(block) {
  const lines = block.split(/\r?\n/).filter((line) => line.trim() !== '');
  const root = lines[0]?.trim() ?? '';
  if (!ROOT.test(root)) return [];
  const paths = [];
  // parents[深さ] = その深さの行の親になるパス（深さ1がルートの直下）
  const parents = [undefined, root];
  for (const line of lines.slice(1)) {
    const indent = line.length - line.trimStart().length;
    const names = namesOf(line.trim());
    const parent = parents[indent / 2];
    if (names.length === 0 || parent === undefined) continue;
    for (const name of names) paths.push(`${parent}${name}`);
    parents.length = indent / 2 + 1;
    parents.push(`${parent}${names[0]}`);
  }
  return paths;
}

/** Markdown の中の構成図に書かれた、プロジェクト相対のパス（書かれた順） */
export function treePaths(markdown) {
  const blocks = markdown.split(/^```.*$/m).filter((_, index) => index % 2 === 1);
  return blocks.flatMap(pathsInBlock);
}
