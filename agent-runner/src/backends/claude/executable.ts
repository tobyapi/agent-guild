// 使う Claude Code の実行ファイル。利用者の環境に入っているものを使う（配布版のアプリには同梱しない）:
// 環境変数 GUILD_CLAUDE_PATH > PATH の claude（Windows の npm の claude.cmd なら、そのパッケージの cli.js）>
// よく入れる場所（公式のインストーラーの ~/.local/bin など）> SDK の同梱（開発中に node_modules にあるときだけ）。

import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { findInDirs, isFile, overridePath, pathDirs } from '../executables.ts';
import { t } from './texts/index.ts';

/** 見つからないときの案内 */
export const claudeNotFound = (): string => t('notFound');

export interface ClaudeLookup {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  home?: string;
  /** どこにもないときに使う、SDK の同梱のもの（開発時だけある） */
  bundled?: () => string | null;
}

/** Claude Code の実行ファイル（.js なら SDK が node で動かす）。見つからなければ null */
export function findClaude(lookup: ClaudeLookup = {}): string | null {
  const env = lookup.env ?? process.env;
  const override = overridePath(env.GUILD_CLAUDE_PATH);
  if (override !== undefined) return override;
  const platform = lookup.platform ?? process.platform;
  const names = [platform === 'win32' ? 'claude.exe' : 'claude'];
  return (
    findInDirs(pathDirs(env), names) ??
    npmCli(env, platform) ??
    findInDirs(commonDirs(platform, lookup.home ?? homedir()), names) ??
    (lookup.bundled ?? bundledClaude)()
  );
}

/** Windows の npm のグローバルな claude.cmd の隣にある、パッケージの cli.js */
function npmCli(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string | null {
  const shim = platform === 'win32' ? findInDirs(pathDirs(env), ['claude.cmd']) : null;
  if (shim === null) return null;
  const cli = join(dirname(shim), 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
  return isFile(cli) ? cli : null;
}

/** PATH になくても見る、Claude Code をよく入れる場所 */
function commonDirs(platform: NodeJS.Platform, home: string): string[] {
  const local = join(home, '.local', 'bin');
  return platform === 'win32'
    ? [local]
    : [local, join(home, '.claude', 'local'), '/opt/homebrew/bin', '/usr/local/bin'];
}

/** SDK の OS ごとのパッケージに同梱された Claude Code（開発中に node_modules にあるときだけ） */
export function bundledClaude(platform: string = process.platform, arch: string = process.arch): string | null {
  try {
    const manifest = createRequire(import.meta.url).resolve(
      `@anthropic-ai/claude-agent-sdk-${platform}-${arch}/package.json`,
    );
    const path = join(dirname(manifest), platform === 'win32' ? 'claude.exe' : 'claude');
    return isFile(path) ? path : null;
  } catch {
    return null;
  }
}
