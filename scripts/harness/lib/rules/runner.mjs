// agent-runner（agent-runner/src/）の規約: アダプタ同士は import しない / stdin・stdout に触れるのは main.ts だけ /
// console は stderr 用ロガー（log.ts）と main.ts だけ。

import { RUNNER_BACKEND_COMMON_MODULES, RUNNER_BACKEND_REGISTRY, RUNNER_CONSOLE_FILES } from '../config.mjs';

const RUNNER_SRC = 'agent-runner/src/';
const BACKENDS = `${RUNNER_SRC}backends/`;
const isTest = (file) => /\.test\.tsx?$/.test(file);

/** backends/ 直下の単位（拡張子を除いた名前。claude.ts と claude/ は同じ「claude」）。backends/ の外なら null */
function backendUnit(path) {
  if (!path.startsWith(BACKENDS)) return null;
  return path.slice(BACKENDS.length).split('/')[0].replace(/\.(tsx?|mjs|js)$/, '');
}

const isAdapter = (unit) => unit !== null && unit !== RUNNER_BACKEND_REGISTRY && !RUNNER_BACKEND_COMMON_MODULES.has(unit);

/**
 * アダプタが import してよい backends/ のものは、自分自身と共通部品だけ。
 * @param {string} file
 * @param {{ specifier: string, line: number, target: { kind: string, path?: string } }[]} imports
 */
export function checkRunnerImports(file, imports) {
  const unit = backendUnit(file);
  if (!isAdapter(unit) || isTest(file)) return [];
  return imports
    .filter(({ target }) => target.kind === 'file')
    .filter(({ target }) => {
      const targetUnit = backendUnit(target.path);
      return targetUnit !== null && targetUnit !== unit && !RUNNER_BACKEND_COMMON_MODULES.has(targetUnit);
    })
    .map(({ specifier, line }) => ({
      file,
      line,
      rule: 'runner-adapter-imports-adapter',
      advice: `アダプタから '${specifier}' を import しない。共通にしたいものは backends/types.ts などの共通部品へ移す`,
    }));
}

/**
 * stdout はプロトコル専用。process.stdin / process.stdout は main.ts だけ（テストは除く）。
 * @param {string} file
 * @param {{ what: string, line: number }[]} uses
 */
export function checkRunnerStdio(file, uses) {
  if (!file.startsWith(RUNNER_SRC) || file === `${RUNNER_SRC}main.ts` || isTest(file)) return [];
  return uses.map(({ what, line }) => ({
    file,
    line,
    rule: 'runner-stdio-outside-main',
    advice: `${what} に触れてよいのは main.ts だけ（stdout はプロトコル専用）。送信は Dispatcher の send を使う`,
  }));
}

/**
 * console.* は使わない（stdout を汚しうるので、ログは log.ts の stderr 用ロガーで出す）。log.ts・main.ts・テストは除く。
 * @param {string} file
 * @param {{ what: string, line: number }[]} uses
 */
export function checkRunnerConsole(file, uses) {
  if (!file.startsWith(RUNNER_SRC) || RUNNER_CONSOLE_FILES.has(file) || isTest(file)) return [];
  return uses.map(({ what, line }) => ({
    file,
    line,
    rule: 'runner-console',
    advice: `${what} は使わない。ログは log.ts の logInfo / logError（stderr）で出す`,
  }));
}
