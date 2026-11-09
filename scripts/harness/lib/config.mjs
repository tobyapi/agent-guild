// 保守性ハーネスの設定値（CLAUDE.md の規約と対応）。規約を変えるときはここと CLAUDE.md を同時に直す。

/** 空行を除いた行数がこの値に達したら違反（= 149 行まで） */
export const LINE_LIMIT = 150;

/** 行数を数える拡張子 */
export const SIZE_CHECKED_EXTENSIONS = ['.ts', '.tsx', '.css', '.mjs', '.rs'];

/** 行数の規約の対象（CLAUDE.md）。プロジェクト相対・区切り / のパスで判定する。src-tauri/crates/* は src と tests */
const SIZE_SCOPE = [/^src\//, /^agent-runner\/src\//, /^scripts\//, /^src-tauri\/src\//, /^src-tauri\/crates\/[^/]+\/(src|tests)\//];

export function isSizeChecked(projectPath) {
  const parts = projectPath.split('/');
  return (
    SIZE_CHECKED_EXTENSIONS.some((extension) => projectPath.endsWith(extension)) &&
    SIZE_SCOPE.some((pattern) => pattern.test(projectPath)) &&
    !parts.some((part) => EXCLUDED_DIRS.has(part))
  );
}

/** check-ts.mjs が見るディレクトリ（プロジェクトルートからの相対パス）と拡張子。Rust 側は Rust のテストが見る */
export const TS_SCAN_ROOTS = ['src', 'agent-runner/src', 'scripts'];
export const TS_SCAN_EXTENSIONS = ['.ts', '.tsx', '.css', '.mjs'];

/** どこにあっても検査しないディレクトリ名 */
export const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'target', '.git', '.old', 'coverage']);

/** import を解決するときに補う拡張子と index ファイル */
export const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs'];
export const RESOLVE_INDEXES = ['index.ts', 'index.tsx'];

/**
 * agent-runner/src/backends/ 直下の単位（拡張子を除いた名前）のうち、アダプタが import してよい共通部品。
 * これと登録表以外はアダプタ（claude.ts と claude/ は同じアダプタ「claude」とみなす）。
 */
export const RUNNER_BACKEND_COMMON_MODULES = new Set(['types', 'describe', 'environment', 'executables', 'skill-files']);
/** アダプタを束ねる登録表（アダプタではないが、アダプタから import してもいけない） */
export const RUNNER_BACKEND_REGISTRY = 'registry';
/** agent-runner で console に触れてよいファイル（stderr 用ロガーと、起動時に console を stderr に向ける main.ts） */
export const RUNNER_CONSOLE_FILES = new Set(['agent-runner/src/log.ts', 'agent-runner/src/main.ts']);
