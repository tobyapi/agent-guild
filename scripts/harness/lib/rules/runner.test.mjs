import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeProject, nonBlankLines } from '../../testSupport.mjs';
import { checkProject, formatViolation } from '../checkProject.mjs';

const summarize = (root) => checkProject(root).map(({ file, line, rule }) => `${file}:${line} ${rule}`);

const RUNNER = {
  'agent-runner/src/main.ts': "process.stdout.write('ok');\nprocess.stdin.on('data', f);",
  'agent-runner/src/log.ts': "process.stderr.write('log');\nglobalThis.console = new Console({});\nconsole.error('x');",
  'agent-runner/src/backends/types.ts': '',
  'agent-runner/src/backends/describe.ts': '',
  'agent-runner/src/backends/skill-files.ts': "import { BackendError } from './types.ts';",
  'agent-runner/src/backends/registry.ts': "import { a } from './claude.ts';\nimport { b } from './codex.ts';",
  'agent-runner/src/backends/claude.ts': [
    "import type { X } from './types.ts';",
    "import { d } from './describe.ts';",
    "import { w } from './skill-files.ts';",
    "import { o } from './claude/options.ts';",
    "import { l } from '../log.ts';",
  ].join('\n'),
  'agent-runner/src/backends/claude/options.ts': "import { p } from './permissions.ts';\nimport type { R } from '../types.ts';",
  'agent-runner/src/backends/claude/permissions.ts': '',
  'agent-runner/src/backends/codex.ts': "import type { X } from './types.ts';",
};

describe('agent-runner の規約', () => {
  it('規約どおりなら違反なし（claude.ts と claude/ は同じアダプタ、registry はアダプタを import してよい）', () => {
    assert.deepEqual(summarize(makeProject(RUNNER)), []);
  });

  it('アダプタ同士・アダプタから registry への import は違反（.js 指定・アダプタのフォルダの中からも）', () => {
    const root = makeProject({
      ...RUNNER,
      'agent-runner/src/backends/codex.ts': "import { x } from './claude.js';\nimport { r } from './registry.ts';",
      'agent-runner/src/backends/claude/permissions.ts': "import { e } from '../codex/events.ts';",
      'agent-runner/src/backends/codex/events.ts': '',
      'agent-runner/src/backends/claude.test.ts': "import { c } from './codex.ts';",
    });
    assert.deepEqual(summarize(root), [
      'agent-runner/src/backends/claude/permissions.ts:1 runner-adapter-imports-adapter',
      'agent-runner/src/backends/codex.ts:1 runner-adapter-imports-adapter',
      'agent-runner/src/backends/codex.ts:2 runner-adapter-imports-adapter',
    ]);
  });

  it('stdin・stdout は main.ts だけ、console は log.ts と main.ts だけ（テストは可）', () => {
    const root = makeProject({
      ...RUNNER,
      'agent-runner/src/dispatcher.ts': "const x = 1;\nprocess.stdout.write('x');\nconsole.log('debug');\nconsole.error('e');",
      'agent-runner/src/dispatcher.test.ts': "vi.spyOn(process.stdout, 'write');\nconsole.log('test');",
    });
    assert.deepEqual(summarize(root), [
      'agent-runner/src/dispatcher.ts:2 runner-stdio-outside-main',
      'agent-runner/src/dispatcher.ts:3 runner-console',
      'agent-runner/src/dispatcher.ts:4 runner-console',
    ]);
  });
});

describe('行数', () => {
  it('src・agent-runner/src・scripts の .ts/.tsx/.css/.mjs が空行を除いて 150 行以上なら違反', () => {
    const root = makeProject({
      'src/ok.ts': nonBlankLines(149),
      'src/big.css': nonBlankLines(150),
      'scripts/big.mjs': `${'\n'.repeat(10)}${nonBlankLines(200)}`,
      'agent-runner/src/big.ts': nonBlankLines(151),
      'src-tauri/big.ts': nonBlankLines(300),
    });
    assert.deepEqual(summarize(root), [
      'agent-runner/src/big.ts:150 max-lines',
      'scripts/big.mjs:160 max-lines',
      'src/big.css:150 max-lines',
    ]);
  });

  it('違反は「ファイル:行 規則名 — 直し方」で出す', () => {
    const [violation] = checkProject(makeProject({ 'src/big.ts': nonBlankLines(160) }));
    assert.equal(formatViolation(violation), 'src/big.ts:150 max-lines — 空行を除いて 160 行（上限 149 行）。責務ごとにファイルを分割する');
  });
});
