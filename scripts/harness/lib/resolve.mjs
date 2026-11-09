// import 指定子の解決。@/ は src/ の別名、./ と ../ は相対パス、それ以外はパッケージ。

import { join, posix } from 'node:path';
import { RESOLVE_EXTENSIONS, RESOLVE_INDEXES } from './config.mjs';
import { isFile } from './files.mjs';

/**
 * @param {string} specifier import の指定子
 * @param {string} fromFile import しているファイル（プロジェクト相対、区切りは /）
 * @param {string} root プロジェクトルート（絶対パス）
 * @returns {{ kind: 'package', name: string } | { kind: 'file', path: string }}
 *   file の path は見つかったファイル。見つからなければ拡張子を補う前の正規化したパス
 */
export function resolveSpecifier(specifier, fromFile, root) {
  const base = localBase(specifier, fromFile);
  if (base === null) return { kind: 'package', name: packageName(specifier) };
  const found = candidates(base).find((candidate) => isFile(join(root, candidate)));
  return { kind: 'file', path: found ?? base };
}

function localBase(specifier, fromFile) {
  if (specifier.startsWith('@/')) return posix.join('src', specifier.slice(2));
  if (/^\.\.?(\/|$)/.test(specifier)) return posix.join(posix.dirname(fromFile), specifier);
  return null;
}

/** '@scope/name/sub' → '@scope/name'、'name/sub' → 'name' */
function packageName(specifier) {
  const parts = specifier.split('/');
  return (specifier.startsWith('@') ? parts.slice(0, 2) : parts.slice(0, 1)).join('/');
}

/** そのまま → 拡張子を補う → NodeNext の .js 指定を .ts に読み替える → ディレクトリの index */
function candidates(base) {
  const withExtensions = (path) => RESOLVE_EXTENSIONS.map((extension) => path + extension);
  const withoutJs = base.replace(/\.m?js$/, '');
  return [
    base,
    ...withExtensions(base),
    ...(withoutJs === base ? [] : withExtensions(withoutJs)),
    ...RESOLVE_INDEXES.map((index) => posix.join(base, index)),
  ];
}
