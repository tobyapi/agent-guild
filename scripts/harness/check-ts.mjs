// 保守性ハーネス（TS 側）: CLAUDE.md の規約を機械的に検査する。
// 対象: src/・agent-runner/src/・scripts/ の行数、React の import 境界、agent-runner の規約。
// 違反は「ファイル:行 規則名 — 直し方」の形で全部出して非ゼロで終わる。

import { fileURLToPath } from 'node:url';
import { checkProject, formatViolation } from './lib/checkProject.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const violations = checkProject(root);

for (const violation of violations) console.log(formatViolation(violation));
if (violations.length > 0) {
  console.error(`\n保守性ハーネス（TS）: 違反 ${violations.length} 件。上の「直し方」に沿って直してください。`);
  process.exitCode = 1;
} else {
  console.log('保守性ハーネス（TS）: 違反なし');
}
