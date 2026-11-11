// ビルドマシン固有のライブラリに依存しないよう、Node.js の公式配布物から実行ファイルとライセンスを取り出す。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// Node.js 22 の公式バイナリは Apple Silicon の macOS 11 でも動く。
const VERSION = 'v22.23.4';
// https://nodejs.org/dist/v22.23.4/SHASUMS256.txt
const RELEASES = {
  'aarch64-apple-darwin': ['darwin-arm64.tar.xz', '037650d0839f457747396f052073fb48333d31bf5abd3c98b74da20d89ebb1ad'],
  'x86_64-apple-darwin': ['darwin-x64.tar.xz', 'f42abca7aaac61efc57d49fb42ea84fc53bbeba9a749cb03a291ce6e4e7a69c1'],
  'x86_64-pc-windows-msvc': ['win-x64.zip', 'cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20'],
  'aarch64-pc-windows-msvc': ['win-arm64.zip', 'a8b8cd79cbbb3062435f449591d98dd63730bbbf30ce2d7cc3a6376c236cb111'],
  'x86_64-unknown-linux-gnu': ['linux-x64.tar.xz', '1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce'],
  'aarch64-unknown-linux-gnu': [
    'linux-arm64.tar.xz',
    '6287aa46b6c375d816e63ae66d024fbbfd70404825aabdfdf898a970871d2f4b',
  ],
};

/** ビルド対象（Tauri が渡すもの。なければこのマシンの対象） */
export function buildTarget() {
  return (
    process.env.TAURI_ENV_TARGET_TRIPLE ?? execFileSync('rustc', ['--print', 'host-tuple'], { encoding: 'utf8' }).trim()
  );
}

export async function stageNode(out) {
  const target = buildTarget();
  if (!Object.hasOwn(RELEASES, target)) throw new Error(`Node.js の同梱に対応していないビルド対象です: ${target}`);
  const [asset, sha256] = RELEASES[target];
  const filename = `node-${VERSION}-${asset}`;
  const url = `https://nodejs.org/dist/${VERSION}/${filename}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Node.js のダウンロードに失敗しました (${response.status}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) {
    throw new Error(`Node.js の SHA-256 が一致しません: ${filename}`);
  }

  const temp = mkdtempSync(join(tmpdir(), 'guild-node-'));
  try {
    const archive = join(temp, filename);
    const windows = asset.endsWith('.zip');
    const folder = filename.replace(/\.(?:zip|tar\.xz)$/, '');
    const node = `${folder}/${windows ? 'node.exe' : 'bin/node'}`;
    const license = `${folder}/LICENSE`;
    writeFileSync(archive, bytes);
    execFileSync('tar', ['-xf', archive, '-C', temp, node, license], { stdio: 'inherit' });
    const bin = join(dirname(out), 'bundled-node');
    mkdirSync(bin, { recursive: true });
    copyFileSync(join(temp, node), join(bin, `guild-node-${target}${windows ? '.exe' : ''}`));
    copyFileSync(join(temp, license), join(out, 'LICENSE.node.txt'));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
