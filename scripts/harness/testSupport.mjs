// ハーネスのテスト用の部品: 一時ディレクトリに小さなプロジェクトを作る。

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after } from 'node:test';

/**
 * { 相対パス: 内容 } のファイルを持つ一時プロジェクトを作り、そのルートを返す（テストの終わりに消す）。
 * @param {Record<string, string>} files
 */
export function makeProject(files) {
  const root = mkdtempSync(join(tmpdir(), 'guild-harness-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

/** 空でない行を n 行並べた文字列 */
export function nonBlankLines(n) {
  return Array.from({ length: n }, (_, index) => `const line${index} = ${index};`).join('\n');
}
