import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundledClaude, findClaude } from './executable.ts';

/** 空のファイルを並べたフォルダ */
function tree(files: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'guild-claude-'));
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), '');
  }
  return root;
}

const none = (): null => null;

describe('使う Claude Code を探す', () => {
  it('環境変数の指定 > PATH > よく入れる場所 > SDK の同梱 の順', () => {
    const root = tree(['bin/claude.exe', 'home/.local/bin/claude.exe', 'custom/claude.exe']);
    const home = join(root, 'home');
    const custom = join(root, 'custom', 'claude.exe');
    expect(findClaude({ env: { PATH: join(root, 'bin') }, platform: 'win32', home, bundled: none })).toBe(
      join(root, 'bin', 'claude.exe'),
    );
    expect(
      findClaude({
        env: { PATH: join(root, 'bin'), GUILD_CLAUDE_PATH: custom },
        platform: 'win32',
        home,
        bundled: none,
      }),
    ).toBe(custom);
    expect(findClaude({ env: {}, platform: 'win32', home, bundled: none })).toBe(
      join(home, '.local', 'bin', 'claude.exe'),
    );
    expect(findClaude({ env: {}, platform: 'win32', home: join(root, 'nowhere'), bundled: () => 'SDK' })).toBe('SDK');
    expect(findClaude({ env: {}, platform: 'win32', home: join(root, 'nowhere'), bundled: none })).toBeNull();
  });

  it('指定された場所になければ、ほかを探さずに見つからないとする', () => {
    const root = tree(['bin/claude.exe']);
    const env = { PATH: join(root, 'bin'), GUILD_CLAUDE_PATH: join(root, 'missing.exe') };
    expect(findClaude({ env, platform: 'win32', home: root, bundled: none })).toBeNull();
  });

  it('Windows の npm の claude.cmd なら、隣のパッケージの cli.js を使う', () => {
    const root = tree(['npm/claude.cmd', 'npm/node_modules/@anthropic-ai/claude-code/cli.js']);
    const cli = join(root, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
    expect(findClaude({ env: { PATH: join(root, 'npm') }, platform: 'win32', home: root, bundled: none })).toBe(cli);
  });

  it('macOS は拡張子のない claude を PATH と ~/.local/bin で探す', () => {
    const root = tree(['bin/claude', 'home/.local/bin/claude']);
    const home = join(root, 'home');
    expect(findClaude({ env: { PATH: join(root, 'bin') }, platform: 'darwin', home, bundled: none })).toBe(
      join(root, 'bin', 'claude'),
    );
    expect(findClaude({ env: {}, platform: 'darwin', home, bundled: none })).toBe(
      join(home, '.local', 'bin', 'claude'),
    );
  });

  it('開発中は SDK の OS ごとのパッケージに同梱された実行ファイルがある', () => {
    const path = bundledClaude();
    expect(path === null ? null : basename(path)).toBe(process.platform === 'win32' ? 'claude.exe' : 'claude');
  });
});
