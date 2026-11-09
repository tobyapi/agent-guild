// React（src/）の import 境界: feature-based の依存の向き・feature の公開 API・バックエンド呼び出しの入口。

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isDirectory, isFile } from '../files.mjs';
import { isTestFile, isTestSupportFile } from './testOnly.mjs';

const isTest = (file) => isTestFile(file) || isTestSupportFile(file);

/** src/ 配下の区分。features なら feature 名も返す */
function areaOf(path) {
  const [top, area, name] = path.split('/');
  if (top !== 'src') return { area: 'outside' };
  if (area === 'features') return { area, feature: name };
  return { area: area === 'shared' || area === 'app' ? area : 'other' };
}

/** 別の feature から import してよいのは index だけ（ファイルが見つからないときは素のディレクトリ指定も可） */
function isFeatureIndex(path, feature) {
  const dir = `src/features/${feature}`;
  return [dir, `${dir}/index`, `${dir}/index.ts`, `${dir}/index.tsx`].includes(path);
}

/** @/shared/api（src/shared/api/ 配下）を import してよいファイル */
function mayUseSharedApi(file) {
  return (
    file.startsWith('src/shared/api/') ||
    file.startsWith('src/app/') ||
    /^src\/features\/[^/]+\/api(\.tsx?|\/)/.test(file) ||
    isTest(file)
  );
}

function packageViolation(file, imported) {
  if (!imported.target.name.startsWith('@tauri-apps/') || file.startsWith('src/shared/api/')) return null;
  return {
    rule: 'tauri-outside-shared-api',
    advice: `${imported.target.name} を使えるのは src/shared/api/ だけ。shared/api の型付きクライアント経由で呼ぶ`,
  };
}

function localViolation(file, imported) {
  const from = areaOf(file);
  const to = areaOf(imported.target.path);
  if (from.area === 'shared' && (to.area === 'features' || to.area === 'app')) {
    return {
      rule: 'shared-imports-upper',
      advice: 'shared/ は features/・app/ を import しない。共通に使うものなら shared/ へ移す',
    };
  }
  if (from.area === 'features' && to.area === 'app') {
    return {
      rule: 'features-imports-app',
      advice: 'features/ は app/ を import しない。必要なものは app/ から渡すか shared/ へ移す',
    };
  }
  if (to.area === 'features' && from.feature !== to.feature && !isFeatureIndex(imported.target.path, to.feature)) {
    return {
      rule: 'feature-deep-import',
      advice: `別の feature は index.ts 経由で import する（'${imported.specifier}' → '@/features/${to.feature}'）`,
    };
  }
  if (imported.target.path.startsWith('src/shared/api/') && !mayUseSharedApi(file)) {
    return {
      rule: 'shared-api-outside-api-layer',
      advice: '@/shared/api を import できるのは features/*/api.ts と app/ だけ。feature の api.ts に関数を足して使う',
    };
  }
  return null;
}

/**
 * @param {string} file src/ 配下の .ts/.tsx
 * @param {{ specifier: string, line: number, target: { kind: string, name?: string, path?: string } }[]} imports
 */
export function checkReactImports(file, imports) {
  if (!file.startsWith('src/')) return [];
  return imports.flatMap((imported) => {
    const found =
      imported.target.kind === 'package' ? packageViolation(file, imported) : localViolation(file, imported);
    return found ? [{ file, line: imported.line, ...found }] : [];
  });
}

/** 各 feature はディレクトリ直下に index.ts（公開 API）を持つ */
export function checkFeatureIndexes(root) {
  const featuresDir = join(root, 'src/features');
  if (!isDirectory(featuresDir)) return [];
  return readdirSync(featuresDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !['index.ts', 'index.tsx'].some((index) => isFile(join(featuresDir, entry.name, index))))
    .map((entry) => ({
      file: `src/features/${entry.name}`,
      line: 1,
      rule: 'feature-missing-index',
      advice: `src/features/${entry.name}/index.ts を作り、他の feature や app/ に見せるものだけを export する`,
    }));
}
