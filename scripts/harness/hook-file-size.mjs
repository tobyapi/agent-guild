// Claude Code の PostToolUse フック（matcher: Edit|Write|MultiEdit）。
// 編集されたファイルが行数の規約の対象（CLAUDE.md）で、空行を除いて200行以上なら、理由を stderr に出して exit 2 で差し戻す。
// 対象外のファイルは見ない。フック自体の不調（入力が読めないなど）では作業を止めない（exit 0）。

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { isSizeChecked, LINE_LIMIT } from './lib/config.mjs';
import { countLines } from './lib/lineCount.mjs';

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

/** 検査対象ならその絶対パスとプロジェクト相対パス（区切りは /）、対象外なら null */
function targetOf(input) {
  const filePath = input?.tool_input?.file_path;
  if (typeof filePath !== 'string') return null;
  const cwd = typeof input.cwd === 'string' ? input.cwd : process.cwd();
  const projectDir = process.env.CLAUDE_PROJECT_DIR || cwd;
  const absolute = resolve(cwd, filePath);
  const rel = relative(projectDir, absolute);
  const outside = rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  const projectPath = rel.split(sep).join('/');
  return outside || !isSizeChecked(projectPath) ? null : { absolute, projectPath };
}

try {
  const target = targetOf(JSON.parse(await readStdin()));
  const count = target && existsSync(target.absolute) ? countLines(readFileSync(target.absolute, 'utf8')).count : 0;
  if (count >= LINE_LIMIT) {
    process.stderr.write(
      `${target.projectPath} は空行を除いて ${count} 行あります（上限 ${LINE_LIMIT - 1} 行）。\n` +
        `CLAUDE.md の保守性ハーネスの規約（1ファイル${LINE_LIMIT}行未満）に違反しています。` +
        '1ファイル1責務になるようにモジュールを分割してから続けてください。\n',
    );
    process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(`hook-file-size: フックの入力を読めないので検査を飛ばしました（${error.message}）\n`);
}
