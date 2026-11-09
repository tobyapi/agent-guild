import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeProject, nonBlankLines } from './testSupport.mjs';

const HOOK = fileURLToPath(new URL('./hook-file-size.mjs', import.meta.url));

const root = makeProject({
  'src/short.ts': nonBlankLines(149),
  'src/long.tsx': nonBlankLines(150),
  'src-tauri/src/long.rs': nonBlankLines(200),
  'src-tauri/crates/runner-client/tests/fixtures/long.mjs': nonBlankLines(150),
  'docs/long.md': nonBlankLines(500),
  'vite.config.ts': nonBlankLines(500),
  'src-tauri/target/debug/long.rs': nonBlankLines(500),
  'node_modules/pkg/long.mjs': nonBlankLines(500),
});

/** フックを Claude Code と同じ形の JSON で呼ぶ */
function runHook(input) {
  const stdin = typeof input === 'string' ? input : JSON.stringify(input);
  return spawnSync(process.execPath, [HOOK], {
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
}

const edited = (filePath, toolName = 'Edit') => ({
  hook_event_name: 'PostToolUse',
  tool_name: toolName,
  cwd: root,
  tool_input: { file_path: filePath },
});

describe('hook-file-size', () => {
  it('149 行までは通す', () => {
    assert.equal(runHook(edited(join(root, 'src/short.ts'))).status, 0);
  });

  it('対象の 150 行以上のファイルは理由を stderr に出して exit 2（相対パスも cwd から解決）', () => {
    const tsx = runHook(edited(join(root, 'src/long.tsx'), 'Write'));
    assert.equal(tsx.status, 2);
    assert.match(tsx.stderr, /src\/long\.tsx は空行を除いて 150 行/);
    assert.match(tsx.stderr, /分割/);
    assert.equal(runHook(edited('src-tauri/src/long.rs', 'MultiEdit')).status, 2);
    assert.equal(runHook(edited(join(root, 'src-tauri/crates/runner-client/tests/fixtures/long.mjs'))).status, 2);
  });

  it('対象外（拡張子・規約の範囲外・除外ディレクトリ・プロジェクト外・存在しない）は通す', () => {
    assert.equal(runHook(edited(join(root, 'docs/long.md'))).status, 0);
    assert.equal(runHook(edited(join(root, 'vite.config.ts'))).status, 0);
    assert.equal(runHook(edited(join(root, 'src-tauri/target/debug/long.rs'))).status, 0);
    assert.equal(runHook(edited(join(root, 'node_modules/pkg/long.mjs'))).status, 0);
    assert.equal(runHook(edited(join(root, '..', 'elsewhere.ts'))).status, 0);
    assert.equal(runHook(edited(join(root, 'src/missing.ts'))).status, 0);
  });

  it('入力が壊れていても作業は止めない', () => {
    const broken = runHook('not json');
    assert.equal(broken.status, 0);
    assert.match(broken.stderr, /検査を飛ばしました/);
    assert.equal(runHook({ tool_input: {} }).status, 0);
  });
});
