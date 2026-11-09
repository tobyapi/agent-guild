// 配布用に agent-runner をまとめる（`npm run bundle` の beforeBuildCommand から呼ばれる）。
// TypeScript を JS にして src-tauri/bundled-runner/ に出し（agent-runner/tsconfig.build.json）、実行に要る npm パッケージ
// （SDK の JS だけ）を node_modules に写す。Claude Code と Codex CLI の実行ファイル（OS ごとのパッケージ）は同梱しない:
// ランナーが利用者の環境に入っているものを探して使う。まとめたものは、アプリのリソースの runner/ として同梱される。

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src-tauri', 'bundled-runner');
/** 実行時に要るパッケージ（OS ごとの実行ファイルのパッケージは入れない） */
const PACKAGES = ['@anthropic-ai/claude-agent-sdk', '@openai/codex-sdk', '@openai/codex'];

rmSync(OUT, { recursive: true, force: true });
const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
execFileSync(process.execPath, [tsc, '-p', join(ROOT, 'agent-runner', 'tsconfig.build.json')], { stdio: 'inherit' });

for (const name of PACKAGES) {
  const from = join(ROOT, 'node_modules', name);
  if (!existsSync(from)) throw new Error(`${name} がありません。先に npm ci を実行してください`);
  cpSync(from, join(OUT, 'node_modules', name), { recursive: true });
}

// package.json は tsc が写したもの（main.js が版を読み、"type": "module" で ESM として動く）。依存の一覧などは要らない
const manifestPath = join(OUT, 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const trimmed = { name: manifest.name, version: manifest.version, type: manifest.type, private: true };
writeFileSync(manifestPath, `${JSON.stringify(trimmed, null, 2)}\n`);
console.log(`agent-runner を ${OUT} にまとめました`);
