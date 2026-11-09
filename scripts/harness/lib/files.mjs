// 検査対象のファイルを列挙する。パスはプロジェクトルートからの相対で、区切りは常に /。

import { readdirSync, statSync } from 'node:fs';
import { extname, join, posix } from 'node:path';
import { EXCLUDED_DIRS } from './config.mjs';

/**
 * @param {string} root プロジェクトルート（絶対パス）
 * @param {readonly string[]} scanRoots 探すディレクトリ（相対パス）。存在しなければ飛ばす
 * @param {readonly string[]} extensions
 * @returns {string[]} 並べ替え済みの相対パス
 */
export function listFiles(root, scanRoots, extensions) {
  const files = [];
  const walk = (dir) => {
    const entries = isDirectory(join(root, dir)) ? readdirSync(join(root, dir), { withFileTypes: true }) : [];
    for (const entry of entries) {
      const path = posix.join(dir, entry.name);
      if (entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name)) walk(path);
      else if (entry.isFile() && extensions.includes(extname(entry.name))) files.push(path);
    }
  };
  scanRoots.forEach(walk);
  return files.sort();
}

export function isDirectory(path) {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

export function isFile(path) {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}
