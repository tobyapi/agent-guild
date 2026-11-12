// 使う Codex CLI。利用者の環境に入っているものを使う（配布版のアプリには同梱しない）:
// 環境変数 GUILD_CODEX_PATH > PATH の codex（Windows の npm の codex.cmd は起動できないので、そのパッケージの中の codex.exe）>
// よく入れる場所 > SDK の同梱（開発中に node_modules にあるときだけ）。npm のパッケージから見つけたら、
// SDK と同じく同梱の ripgrep などのフォルダを PATH に足す。

import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { findInDirs, isDirectory, isFile, overridePath, pathDirs } from '../executables.ts';
import { t } from './texts/index.ts';

/** 見つからないときの案内 */
export const codexNotFound = (): string => t('notFound');

export interface CodexExecutable {
  path: string;
  /** codex の PATH の先頭に足すフォルダ（npm のパッケージの ripgrep など） */
  pathDirs: string[];
}

export interface CodexLookup {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  arch?: string;
  home?: string;
  /** どこにもないときに使う、SDK の同梱のもの（開発時だけある） */
  bundled?: () => CodexExecutable | null;
}

/** OS と CPU ごとの、npm のパッケージの中のフォルダ名 */
const TRIPLES: Readonly<Record<string, string>> = {
  'win32-x64': 'x86_64-pc-windows-msvc',
  'win32-arm64': 'aarch64-pc-windows-msvc',
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-musl',
  'linux-arm64': 'aarch64-unknown-linux-musl',
};

/** Codex CLI の実行ファイル。見つからなければ null */
export function findCodex(lookup: CodexLookup = {}): CodexExecutable | null {
  const env = lookup.env ?? process.env;
  const override = overridePath(env.GUILD_CODEX_PATH);
  if (override !== undefined) return override === null ? null : plain(override);
  const platform = lookup.platform ?? process.platform;
  const found = fromPath(pathDirs(env), platform, lookup.arch ?? process.arch);
  if (found !== null) return found;
  const installed = findInDirs(commonDirs(platform, lookup.home ?? homedir(), env.LOCALAPPDATA), [
    binaryName(platform),
  ]);
  return installed === null ? (lookup.bundled ?? bundledCodex)() : plain(installed);
}

/** PATH の codex。Windows の npm の codex.cmd は起動できないので、隣のパッケージの中の実行ファイルにする */
function fromPath(dirs: readonly string[], platform: NodeJS.Platform, arch: string): CodexExecutable | null {
  const direct = findInDirs(dirs, [binaryName(platform)]);
  if (direct !== null) return plain(direct);
  const shim = platform === 'win32' ? findInDirs(dirs, ['codex.cmd']) : null;
  return shim === null ? null : nativeCodex(join(dirname(shim), 'node_modules', '@openai', 'codex'), platform, arch);
}

/** PATH になくても見る、Codex CLI をよく入れる場所 */
function commonDirs(platform: NodeJS.Platform, home: string, localAppData: string | undefined): string[] {
  const local = join(home, '.local', 'bin');
  if (platform !== 'win32') return ['/opt/homebrew/bin', '/usr/local/bin', local];
  return localAppData ? [local, join(localAppData, 'Programs', 'OpenAI', 'Codex', 'bin')] : [local];
}

function binaryName(platform: string): string {
  return platform === 'win32' ? 'codex.exe' : 'codex';
}

function plain(path: string): CodexExecutable {
  return { path, pathDirs: [] };
}

/** npm の @openai/codex パッケージ（のフォルダ）から、OS ごとのパッケージの中の実行ファイルを探す（SDK と同じ並び） */
export function nativeCodex(
  packageDir: string,
  platform: string = process.platform,
  arch: string = process.arch,
): CodexExecutable | null {
  const triple = TRIPLES[`${platform}-${arch}`];
  if (triple === undefined) return null;
  let vendor: string;
  try {
    const manifest = createRequire(join(packageDir, 'package.json')).resolve(
      `@openai/codex-${platform}-${arch}/package.json`,
    );
    vendor = join(dirname(manifest), 'vendor', triple);
  } catch {
    return null;
  }
  const binary = binaryName(platform);
  const current = join(vendor, 'bin', binary);
  if (isFile(current)) return { path: current, pathDirs: [join(vendor, 'codex-path')].filter(isDirectory) };
  const legacy = join(vendor, 'codex', binary);
  if (isFile(legacy)) return { path: legacy, pathDirs: [join(vendor, 'path')].filter(isDirectory) };
  return null;
}

/** SDK が使う @openai/codex に同梱された実行ファイル（開発中に node_modules にあるときだけ） */
function bundledCodex(): CodexExecutable | null {
  try {
    return nativeCodex(dirname(createRequire(import.meta.url).resolve('@openai/codex/package.json')));
  } catch {
    return null;
  }
}
