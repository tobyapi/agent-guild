// 自動アップデートの配布元に置く latest.json を作る（docs/design.md「アプリの更新」）。CI（.github/workflows/build.yml）が、
// タグのビルドで集めた配布物と署名（*.sig）から作って、リリースに添付する。
//   node scripts/update-manifest.mjs <配布物のフォルダ> <タグ> <owner/repo>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** 配布物の名前に入っているビルドの名前（build.yml の matrix.name）→ 更新プラグインの対象名 */
const PLATFORMS = { 'windows-x64': 'windows-x86_64', 'macos-arm64': 'darwin-aarch64' };

/** タグ（v0.2.0）とアプリの版（0.2.0）が合っていなければ、理由を返す。合っていれば null */
export function versionProblem(tag, version) {
  if (tag === `v${version}`) return null;
  return `タグ ${tag} とアプリの版 ${version} が合っていません（タグは v${version} にする。合わないと、更新した後も「新しい版があります」が出続ける）`;
}

/** 署名のファイル名（agent-guild_windows-x64_….exe.sig）から、対象名と配布物の名前を読む。対象が分からなければ null */
export function updateTarget(signatureName) {
  const artifact = signatureName.replace(/\.sig$/, '');
  const platform = Object.keys(PLATFORMS).find((name) => artifact.includes(`_${name}_`));
  return platform ? { platform: PLATFORMS[platform], artifact } : null;
}

/** latest.json の中身。signatures は { 署名のファイル名: 署名の中身 } */
export function buildManifest({ version, tag, repository, signatures, pubDate, notes = '' }) {
  const platforms = {};
  for (const [name, signature] of Object.entries(signatures)) {
    const target = updateTarget(name);
    if (!target) throw new Error(`どの OS 向けの署名か分かりません: ${name}`);
    if (Object.hasOwn(platforms, target.platform)) throw new Error(`同じ OS 向けの署名が2つあります: ${name}`);
    const url = `https://github.com/${repository}/releases/download/${tag}/${encodeURIComponent(target.artifact)}`;
    platforms[target.platform] = { signature: signature.trim(), url };
  }
  if (Object.keys(platforms).length === 0) {
    throw new Error('署名（*.sig）がありません。TAURI_SIGNING_PRIVATE_KEY を Secrets に登録してください');
  }
  return { version, notes, pub_date: pubDate, platforms };
}

function main([dir, tag, repository]) {
  if (!dir || !tag || !repository) throw new Error('使い方: update-manifest.mjs <フォルダ> <タグ> <owner/repo>');
  const { version } = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  const problem = versionProblem(tag, version);
  if (problem) throw new Error(problem);
  const names = readdirSync(dir).filter((name) => name.endsWith('.sig'));
  const signatures = Object.fromEntries(names.map((name) => [name, readFileSync(join(dir, name), 'utf8')]));
  const manifest = buildManifest({ version, tag, repository, signatures, pubDate: new Date().toISOString() });
  writeFileSync(join(dir, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`latest.json: ${version}（${Object.keys(manifest.platforms).join(', ')}）`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
