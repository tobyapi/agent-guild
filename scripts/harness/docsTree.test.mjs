import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { treePaths } from './lib/docTree.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

describe('treePaths', () => {
  it('構成図の名前を、字下げから親をたどってパスにする（説明と、説明の続きの行は読まない）', () => {
    const markdown = [
      '文章の中の `src/none.ts` は読まない。',
      '```',
      'app/',
      '  main.ts, lib.ts        入口（説明の中の other.ts は読まない）',
      '  core/                  中心',
      '    a.ts                 説明',
      '                         説明の続き more.ts',
      '    deep/x/              入れ子のフォルダ',
      '  one/ two/              並べたフォルダ',
      '    index.ts             最初の名前（one/）の下',
      '```',
      '```rust',
      'fn not_a_tree() {}',
      '```',
    ].join('\n');
    assert.deepEqual(treePaths(markdown), [
      'app/main.ts',
      'app/lib.ts',
      'app/core/',
      'app/core/a.ts',
      'app/core/deep/x/',
      'app/one/',
      'app/two/',
      'app/one/index.ts',
    ]);
  });
});

describe('docs/architecture.md', () => {
  const paths = treePaths(readFileSync(join(ROOT, 'docs/architecture.md'), 'utf8'));

  it('構成図に書いたファイルとフォルダが実在する', () => {
    assert.ok(paths.length > 40, `構成図から読めたパスが少なすぎます（${paths.length} 件）`);
    const missing = paths.filter((path) => !existsSync(join(ROOT, path)));
    assert.deepEqual(missing, [], '構成図にあるのに実在しないパス。図か構成のどちらかを直す');
  });
});
