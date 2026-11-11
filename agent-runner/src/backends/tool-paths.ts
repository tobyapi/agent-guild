// ファイル道具の入力からパスを取り出す部品と、パスや Glob の pattern の「形」だけで拒否する判定。
// 判定するパスと道具が実際に使うパスを食い違わせない（道具ごとに決まった項目だけを見る）ことと、
// OS が特別に解釈する書き方（Windows のネットワークパス・デバイスパス・代替データストリーム）を通さないことが目的。

import { isAbsolute } from 'node:path';
import { isInside } from './types.ts';

const PATH_FIELDS = ['file_path', 'notebook_path', 'path'] as const;
type PathField = (typeof PATH_FIELDS)[number];

/** 道具が実際に読む・書く場所として使う項目 */
const TOOL_PATH_FIELD: Readonly<Record<string, PathField>> = {
  Read: 'file_path',
  Write: 'file_path',
  Edit: 'file_path',
  MultiEdit: 'file_path',
  NotebookEdit: 'notebook_path',
  Glob: 'path',
  Grep: 'path',
  LS: 'path',
};

const filled = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** その道具が使うパスの項目の値（指定がなければ undefined）。知らない道具は、あるものを順に探す */
export function toolPath(tool: string, input: Record<string, unknown>): string | undefined {
  const field = TOOL_PATH_FIELD[tool];
  const fields: readonly PathField[] = field === undefined ? PATH_FIELDS : [field];
  return fields.map((key) => input[key]).find(filled);
}

/** その道具が使わないパスの項目に値が入っていたら、その項目名（判定と実際の対象がずれるので拒否する） */
export function strayPathField(tool: string, input: Record<string, unknown>): string | null {
  const field = TOOL_PATH_FIELD[tool];
  if (field === undefined) return null;
  return PATH_FIELDS.find((key) => key !== field && filled(input[key])) ?? null;
}

/**
 * 解決済みの絶対パスが、Windows で特別に解釈される書き方なら理由を返す。
 * - `\\server\share`・`\\?\`・`\\.\`: 開くだけで外のサーバーへ認証つきで接続したり、パスの検査をすり抜けたりする
 *   （roots の中にあるもの、つまり作業場所そのものがネットワーク上にある場合は通す）
 * - ドライブ名のあとの `:`: 代替データストリーム（`secret.pem::$DATA` のように別名で同じ中身を開ける）
 */
export function unsafePathForm(
  target: string,
  roots: readonly string[],
  platform: NodeJS.Platform = process.platform,
): string | null {
  if (platform !== 'win32') return null;
  if (/^[\\/]{2}/.test(target) && !roots.some((root) => isInside(target, root))) {
    return 'ネットワークパスとデバイスパス（\\\\ で始まるパス）は使えません';
  }
  if (target.replace(/^[A-Za-z]:/, '').includes(':'))
    return 'パスに「:」を含む指定（代替データストリーム）は使えません';
  return null;
}

/** 波括弧の中に置けない文字（展開すると `..` や絶対パスを組み立てられるもの） */
const BRACE_UNSAFE = /[./\\:~]/;

/** 波括弧の中に、空の選択肢か、パスを組み立てられる文字があるか（閉じていない波括弧は、残り全部を中とみなす） */
function unsafeBraces(pattern: string): boolean {
  let depth = 0;
  let inside = '';
  for (const char of pattern) {
    if (char === '{') depth += 1;
    if (depth > 0) inside += char;
    if (char === '}' && depth > 0) depth -= 1;
  }
  return BRACE_UNSAFE.test(inside) || /\{[,}]|,[,}]/.test(inside);
}

/**
 * Glob の pattern が起点（path）の外を一覧できる形なら理由を返す: 絶対パス・ドライブ名つき・`..`・
 * 展開で `..` や絶対パスを作れる波括弧。`**\/*.{ts,tsx}` のような普通の指定は通す。
 */
export function globEscapeReason(pattern: unknown, platform: NodeJS.Platform = process.platform): string | null {
  if (typeof pattern !== 'string') return null;
  if (isAbsolute(pattern) || (platform === 'win32' && /^[A-Za-z]:/.test(pattern))) {
    return 'Glob の絶対パス pattern は使えません。path に起点、pattern に相対パターンを指定してください';
  }
  if (pattern.includes('..') || unsafeBraces(pattern)) {
    return 'Glob の pattern に「..」や、波括弧の中の「.」「/」「:」「~」・空の選択肢は使えません。path に起点を指定してください';
  }
  return null;
}
