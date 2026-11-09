// ESLint（flat config）。保守性ハーネスのうち ESLint が受け持つもの:
// ファイルの行数・関数の長さ・循環的複雑度（CLAUDE.md）、react-hooks の推奨、typescript-eslint。
// import の境界や agent-runner の規約は scripts/harness/check-ts.mjs が検査する。

import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** 型情報つきで検査するソース（それぞれ最寄りの tsconfig.json を使う） */
const TYPED_SOURCES = ['src/**/*.{ts,tsx}', 'agent-runner/src/**/*.ts'];

export default defineConfig([
  globalIgnores(['dist/', 'node_modules/', 'src-tauri/', '.old/', 'coverage/']),
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    extends: [js.configs.recommended],
    rules: {
      'max-lines': ['error', { max: 149, skipBlankLines: true, skipComments: false }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 12],
    },
  },
  {
    // 設定ファイル（vite.config.ts など）を含む TS 全般。型情報なし
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
  },
  {
    files: TYPED_SOURCES,
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['agent-runner/**/*.ts', 'scripts/**/*.{js,mjs}', '*.{js,mjs,cjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    // stdout はプロトコル専用。ログは log.ts の stderr 用ロガーで出す（main.ts は起動時に console を stderr に向ける）
    files: ['agent-runner/src/**/*.ts'],
    ignores: ['agent-runner/src/log.ts', 'agent-runner/src/main.ts', '**/*.test.ts'],
    rules: { 'no-console': 'error' },
  },
  {
    // テストの describe はテストケースの入れ物なので、関数の長さは数えない（ファイルの行数は数える）
    files: ['**/*.test.{ts,tsx,mjs}'],
    rules: { 'max-lines-per-function': 'off' },
  },
]);
