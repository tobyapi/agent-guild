// 配布用に agent-runner をまとめる（`npm run bundle` の beforeBuildCommand から呼ばれる）。
// TypeScript を JS にして src-tauri/bundled-runner/ に出し（agent-runner/tsconfig.build.json）、実行に要る npm パッケージを
// node_modules に写す。写すのは、まとめた JS が読み込むパッケージと、その dependencies・peerDependencies をたどったもの
// （手書きの一覧にすると、SDK が前提にする zod などが漏れる）。OS ごとの実行ファイルのパッケージ（optionalDependencies）は
// 入れない: Claude Code と Codex CLI は、ランナーが利用者の環境に入っているものを探して使う。
// 最後に、まとめたものから各パッケージを実際に読み込んで確かめ、足りなければ失敗する。

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src-tauri', 'bundled-runner');
/** JS からは読み込まないが、実行時に要るパッケージ（Codex SDK が codex の場所を探すのに使う） */
const EXTRA_PACKAGES = ['@openai/codex'];
/** import 文・動的 import の指定子 */
const SPECIFIER = /\bfrom\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

/** 'zod/v4' → 'zod'、'@scope/name/sub' → '@scope/name' */
const packageOf = (specifier) => specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/');
const isBare = (specifier) => !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('node:');

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : jsFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

/** まとめた JS が読み込むパッケージ外の指定子 */
function importedSpecifiers() {
  const specifiers = new Set();
  for (const file of jsFiles(OUT)) {
    for (const match of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
      const specifier = match[1] ?? match[2];
      if (specifier && isBare(specifier)) specifiers.add(specifier);
    }
  }
  return [...specifiers];
}

/** dependencies と（入っていれば）peerDependencies をたどった、写すパッケージの一覧 */
function packageClosure(roots) {
  const found = new Set();
  const visit = (name) => {
    if (found.has(name)) return;
    const manifestPath = join(ROOT, 'node_modules', name, 'package.json');
    if (!existsSync(manifestPath)) throw new Error(`${name} がありません。先に npm ci を実行してください`);
    found.add(name);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) visit(dependency);
    for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
      if (existsSync(join(ROOT, 'node_modules', peer))) visit(peer);
    }
  };
  roots.forEach(visit);
  return [...found].sort();
}

/** まとめたランナーの場所から、各指定子を実際に読み込めるか確かめる */
function verifyImports(specifiers) {
  const checker = join(OUT, 'agent-runner', 'src', '__stage-check.mjs');
  const body = specifiers.map((specifier) => `await import(${JSON.stringify(specifier)});`).join('\n');
  writeFileSync(checker, `${body}\n`);
  try {
    execFileSync(process.execPath, [fileURLToPath(pathToFileURL(checker))], { stdio: 'inherit' });
  } finally {
    rmSync(checker, { force: true });
  }
}

rmSync(OUT, { recursive: true, force: true });
const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
execFileSync(process.execPath, [tsc, '-p', join(ROOT, 'agent-runner', 'tsconfig.build.json')], { stdio: 'inherit' });

const specifiers = importedSpecifiers();
const packages = packageClosure([...new Set([...specifiers.map(packageOf), ...EXTRA_PACKAGES])]);
for (const name of packages) {
  cpSync(join(ROOT, 'node_modules', name), join(OUT, 'node_modules', name), { recursive: true });
}

// package.json は tsc が写したもの（main.js が版を読み、"type": "module" で ESM として動く）。依存の一覧などは要らない
const manifestPath = join(OUT, 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const trimmed = { name: manifest.name, version: manifest.version, type: manifest.type, private: true };
writeFileSync(manifestPath, `${JSON.stringify(trimmed, null, 2)}\n`);

verifyImports(specifiers);
console.log(`agent-runner を ${OUT} にまとめました（パッケージ ${packages.length} 個: ${packages.join(', ')}）`);
