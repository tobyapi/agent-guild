// テスト専用のコード: vitest を import してよいのはテスト（*.test.ts）とテスト用の部品（*.test-support.ts）だけ。
// テスト用の部品は、テストとほかのテスト用の部品からだけ import できる（本番のコードに混ざらない）。

/** テスト（*.test.ts / *.test.tsx） */
export const isTestFile = (file) => /\.test\.tsx?$/.test(file);

/** テスト用の部品（*.test-support.ts / *.test-support.tsx）。テストの組み立てや共通の値を置く */
export const isTestSupportFile = (file) => /\.test-support\.tsx?$/.test(file);

const isTestCode = (file) => isTestFile(file) || isTestSupportFile(file);

/**
 * @param {string} file
 * @param {{ specifier: string, line: number, target: { kind: string, name?: string, path?: string } }[]} imports
 */
export function checkTestOnlyImports(file, imports) {
  if (isTestCode(file)) return [];
  return imports.flatMap((imported) => {
    const { target } = imported;
    if (target.kind === 'package' && target.name === 'vitest') {
      const advice =
        'vitest を import できるのはテストとテスト用の部品だけ。テストの組み立ては <名前>.test-support.ts に置く';
      return [{ file, line: imported.line, rule: 'vitest-outside-tests', advice }];
    }
    if (target.kind === 'file' && isTestSupportFile(target.path)) {
      const advice = `${target.path} はテスト用の部品なので、テスト（*.test.ts）からだけ import する`;
      return [{ file, line: imported.line, rule: 'test-support-in-production', advice }];
    }
    return [];
  });
}
