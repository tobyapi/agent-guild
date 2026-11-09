import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countLines } from './lineCount.mjs';
import { collectConsoleUses, collectImports, collectStdioUses, parseSource } from './source.mjs';

const imports = (text, file = 'src/a.ts') => collectImports(parseSource(file, text));
const stdio = (text) => collectStdioUses(parseSource('agent-runner/src/a.ts', text)).map(({ what }) => what);
const consoles = (text) => collectConsoleUses(parseSource('agent-runner/src/a.ts', text)).map(({ what }) => what);

describe('collectImports', () => {
  it('import・export from・export *・動的 import・require・import 型を行番号つきで拾う', () => {
    const found = imports(
      [
        "import a from '@/features/a';",
        "import type { B } from './b';",
        "export * from '../c';",
        "export { d } from './d.ts';",
        "const e = await import('./e');",
        "const f = require('f');",
        "type G = import('./g').G;",
        "import './side-effect.css';",
      ].join('\n'),
    );
    assert.deepEqual(found, [
      { specifier: '@/features/a', line: 1 },
      { specifier: './b', line: 2 },
      { specifier: '../c', line: 3 },
      { specifier: './d.ts', line: 4 },
      { specifier: './e', line: 5 },
      { specifier: 'f', line: 6 },
      { specifier: './g', line: 7 },
      { specifier: './side-effect.css', line: 8 },
    ]);
  });

  it('コメントや文字列の中の import は拾わない', () => {
    const text = "// import x from '@/app';\n/* import('@/app') */\nconst s = \"import y from '@/app'\";";
    assert.deepEqual(imports(text), []);
  });

  it('TSX も解析できる', () => {
    const text = "import { Button } from '@/shared/ui';\nexport const A = () => <Button />;";
    assert.deepEqual(imports(text, 'src/A.tsx'), [{ specifier: '@/shared/ui', line: 1 }]);
  });
});

describe('collectStdioUses', () => {
  it('process.stdout・stdin への接触のしかたを全部拾う', () => {
    const found = stdio(
      [
        "process.stdout.write('x');",
        "process['stdin'].on('data', f);",
        'const { stdout: out } = process;',
        "import { stdin } from 'node:process';",
        'globalThis.process.stdout.write(s);',
      ].join('\n'),
    );
    assert.deepEqual(found, ['process.stdout', 'process.stdin', 'process.stdout', 'process.stdin', 'process.stdout']);
  });

  it('process.stderr は拾わない', () => {
    assert.deepEqual(stdio("process.stderr.write('x');"), []);
  });

  it('文字列やコメントの中の process.stdout は拾わない', () => {
    assert.deepEqual(stdio("// process.stdout\nconst s = 'process.stdout';"), []);
  });
});

describe('collectConsoleUses', () => {
  it('stdout・stderr を問わず console のメンバーへの接触を拾う', () => {
    const found = consoles("console.log(1);\nconsole.error(2);\nconst w = console.warn;\nglobalThis.console.info(3);\nconsole['debug'](4);");
    assert.deepEqual(found, ['console.log', 'console.error', 'console.warn', 'console.info', "console.'debug'"]);
  });

  it('コメント・文字列・別のオブジェクトの log は拾わない', () => {
    assert.deepEqual(consoles("// console.log(1)\nconst s = 'console.log';\nlogger.log(1);"), []);
  });
});

describe('countLines', () => {
  it('空行と空白だけの行を除いて数え、150 行目に達した行を返す', () => {
    assert.deepEqual(countLines('a\n\n  \nb\r\nc'), { count: 3, overflowLine: null });
    const text = ['x', ...Array.from({ length: 149 }, () => '\ny')].join('\n');
    assert.deepEqual(countLines(text), { count: 150, overflowLine: 299 });
  });
});
