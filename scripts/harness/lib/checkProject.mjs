// TS 側の全規則をプロジェクトに適用し、違反を { file, line, rule, advice } の配列で返す。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TS_SCAN_EXTENSIONS, TS_SCAN_ROOTS } from './config.mjs';
import { listFiles } from './files.mjs';
import { countLines, lineLimitAdvice } from './lineCount.mjs';
import { resolveSpecifier } from './resolve.mjs';
import { checkFeatureIndexes, checkReactImports } from './rules/react.mjs';
import { checkRunnerConsole, checkRunnerImports, checkRunnerStdio } from './rules/runner.mjs';
import { checkTestOnlyImports } from './rules/testOnly.mjs';
import { collectConsoleUses, collectImports, collectStdioUses, parseSource } from './source.mjs';

function checkSize(file, text) {
  const { count, overflowLine } = countLines(text);
  return overflowLine === null ? [] : [{ file, line: overflowLine, rule: 'max-lines', advice: lineLimitAdvice(count) }];
}

/** import 境界・テスト専用のコード・stdio・console の規則（.ts / .tsx だけ構文解析する） */
function checkSource(root, file, text) {
  if (!/\.tsx?$/.test(file)) return [];
  const source = parseSource(file, text);
  const imports = collectImports(source).map((imported) => ({
    ...imported,
    target: resolveSpecifier(imported.specifier, file, root),
  }));
  const testOnly = checkTestOnlyImports(file, imports);
  if (!file.startsWith('agent-runner/')) return [...testOnly, ...checkReactImports(file, imports)];
  return [
    ...testOnly,
    ...checkRunnerImports(file, imports),
    ...checkRunnerStdio(file, collectStdioUses(source)),
    ...checkRunnerConsole(file, collectConsoleUses(source)),
  ];
}

export function sortViolations(violations) {
  return [...violations].sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule),
  );
}

/** @param {string} root プロジェクトルート（絶対パス） */
export function checkProject(root) {
  const violations = listFiles(root, TS_SCAN_ROOTS, TS_SCAN_EXTENSIONS).flatMap((file) => {
    const text = readFileSync(join(root, file), 'utf8');
    return [...checkSize(file, text), ...checkSource(root, file, text)];
  });
  return sortViolations([...violations, ...checkFeatureIndexes(root)]);
}

/** 「ファイル:行 規則名 — 直し方」 */
export function formatViolation({ file, line, rule, advice }) {
  return `${file}:${line} ${rule} — ${advice}`;
}
