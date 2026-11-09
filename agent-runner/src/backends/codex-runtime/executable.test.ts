import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findCodex } from './executable.ts';

/** ファイルを並べたフォルダ（package.json は中身のある JSON、ほかは空。/ で終わるものはフォルダ） */
function tree(files: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'guild-codex-'));
  for (const file of files) {
    if (file.endsWith('/')) {
      mkdirSync(join(root, file), { recursive: true });
      continue;
    }
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), file.endsWith('package.json') ? '{"name":"x"}' : '');
  }
  return root;
}

const none = (): null => null;
const VENDOR = 'npm/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc';
const NPM_PACKAGES = [
  'npm/codex.cmd',
  'npm/node_modules/@openai/codex/package.json',
  'npm/node_modules/@openai/codex-win32-x64/package.json',
];

describe('使う Codex CLI を探す', () => {
  it('PATH の codex.exe はそのまま、指定があればそれを使い、なければ見つからない', () => {
    const root = tree(['bin/codex.exe', 'custom/codex.exe']);
    const env = { PATH: join(root, 'bin') };
    const lookup = { platform: 'win32' as const, arch: 'x64', home: root, bundled: none };
    expect(findCodex({ ...lookup, env })).toEqual({ path: join(root, 'bin', 'codex.exe'), pathDirs: [] });
    const custom = join(root, 'custom', 'codex.exe');
    expect(findCodex({ ...lookup, env: { ...env, GUILD_CODEX_PATH: custom } })).toEqual({ path: custom, pathDirs: [] });
    expect(findCodex({ ...lookup, env: { ...env, GUILD_CODEX_PATH: join(root, 'missing.exe') } })).toBeNull();
    expect(findCodex({ ...lookup, env: {} })).toBeNull();
  });

  it('Windows の npm の codex.cmd なら、パッケージの中の codex.exe と、PATH に足す ripgrep のフォルダ', () => {
    const root = tree([
      ...NPM_PACKAGES,
      `${VENDOR}/bin/codex.exe`,
      `${VENDOR}/codex-package.json`,
      `${VENDOR}/codex-path/`,
    ]);
    expect(
      findCodex({ env: { PATH: join(root, 'npm') }, platform: 'win32', arch: 'x64', home: root, bundled: none }),
    ).toEqual({
      path: join(root, VENDOR, 'bin', 'codex.exe'),
      pathDirs: [join(root, VENDOR, 'codex-path')],
    });
  });

  it('古い並び（vendor/<triple>/codex/codex.exe と path）にも対応する', () => {
    const root = tree([...NPM_PACKAGES, `${VENDOR}/codex/codex.exe`, `${VENDOR}/path/`]);
    expect(
      findCodex({ env: { PATH: join(root, 'npm') }, platform: 'win32', arch: 'x64', home: root, bundled: none }),
    ).toEqual({
      path: join(root, VENDOR, 'codex', 'codex.exe'),
      pathDirs: [join(root, VENDOR, 'path')],
    });
  });

  it('macOS は拡張子のない codex を PATH とよく入れる場所で探し、どこにもなければ SDK の同梱', () => {
    const root = tree(['bin/codex', 'home/.local/bin/codex']);
    const home = join(root, 'home');
    expect(
      findCodex({ env: { PATH: join(root, 'bin') }, platform: 'darwin', arch: 'arm64', home, bundled: none })?.path,
    ).toBe(join(root, 'bin', 'codex'));
    expect(findCodex({ env: {}, platform: 'darwin', arch: 'arm64', home, bundled: none })?.path).toBe(
      join(home, '.local', 'bin', 'codex'),
    );
    const sdk = { path: 'SDK', pathDirs: [] };
    expect(
      findCodex({ env: {}, platform: 'darwin', arch: 'arm64', home: join(root, 'nowhere'), bundled: () => sdk }),
    ).toBe(sdk);
  });
});
