import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { buildManifest, versionProblem } from './update-manifest.mjs';

const SDK = '@openai/codex-sdk';
const CLI = '@openai/codex';
const CLI_PLATFORMS = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-arm64', 'win32-x64'];
const STABLE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, data) => writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);

function isNewer(candidate, current) {
  const component = candidate.findIndex((value, index) => index > 0 && value !== current[index]);
  return component !== -1 && BigInt(candidate[component]) > BigInt(current[component]);
}

function checkPublishedRelease(tag) {
  const { version } = readJson('package.json');
  const app = STABLE.exec(version);
  const published = tag?.startsWith('v') && STABLE.exec(tag.slice(1));
  assert(app, `アプリの版が不正です: ${version}`);
  assert(published, `最新リリースのタグが不正です: ${tag}`);
  if (isNewer(app, published)) {
    console.error(
      `::error::アプリの v${version} が未公開です（公開済み: ${tag}）。手作業のリリースなら下書きを公開し、自動更新の公開に失敗したのなら元の実行で Re-run failed jobs を選んでください`,
    );
    process.exitCode = 1;
  }
}

function readPackageMetadata(path) {
  const metadata = readJson(path);
  const versions = metadata?.versions;
  assert(versions && typeof versions === 'object' && !Array.isArray(versions), 'npm の版一覧を取得できませんでした');
  return metadata;
}

function registryVersionProblem(versions, version) {
  if (!STABLE.test(version)) return 'プレリリースです';
  const metadata = versions[version];
  if (!metadata) return 'レジストリに存在しません';
  if (metadata.deprecated) return '非推奨（deprecated）です';
  return null;
}

function newestEligibleSdk({ time, versions }, cutoff, current, latestBase, latest) {
  let newest = current;
  for (const [version, timestamp] of Object.entries(time)) {
    const candidate = STABLE.exec(version);
    if (!candidate || !isNewer(candidate, newest) || isNewer(candidate, latestBase)) continue;
    // 同じ版番号なら、安定版はプレリリースより新しい。
    if (version === latestBase[0] && version !== latest) continue;
    if (Date.parse(timestamp) <= cutoff && !registryVersionProblem(versions, version)) newest = candidate;
  }
  return newest[0];
}

function check(metadataPath) {
  const installed = readJson('package-lock.json').packages[`node_modules/${SDK}`].version;
  const current = STABLE.exec(installed);
  assert(current, `ロック済みの SDK の版が安定版ではありません: ${installed}`);

  const metadata = readPackageMetadata(metadataPath);
  const latest = metadata['dist-tags']?.latest;
  assert.equal(typeof latest, 'string', 'npm が SDK の版を返しませんでした');
  const latestBase = STABLE.exec(latest.split('-')[0]);
  assert(latestBase, `npm の版が不正です: ${latest}`);

  if (!isNewer(latestBase, current)) {
    console.log(
      `::notice::ロックより新しい SDK の安定版がないため見送ります（ロック: ${installed}、latest: ${latest}）`,
    );
    return;
  }

  const ageSetting = process.env.MIN_AGE_HOURS ?? '72';
  const minAge = Number(ageSetting);
  assert(/^\d+$/.test(ageSetting) && Number.isSafeInteger(minAge), 'MIN_AGE_HOURS は0以上の整数で指定してください');

  const latestProblem = registryVersionProblem(metadata.versions, latest);
  if (minAge === 0 && latestProblem) {
    console.log(`::notice::SDK の latest（${latest}）は${latestProblem}。更新を見送ります`);
    return;
  }

  let selected = latest;
  if (minAge > 0) {
    const cutoff = Date.now() - minAge * 3_600_000;
    selected = newestEligibleSdk(metadata, cutoff, current, latestBase, latest);
    if (selected === installed) {
      console.log(`::notice::公開から ${minAge} 時間以上たった更新候補がないため見送ります（latest: ${latest}）`);
      return;
    }

    if (selected !== latest) {
      const reason =
        latestProblem ??
        (Date.parse(metadata.time[latest]) > cutoff
          ? `公開から ${minAge} 時間が経過していません`
          : '公開日時を確認できません');
      console.log(`::notice::SDK の latest（${latest}）は${reason}。条件を満たす ${selected} を選びます`);
    }
  }

  console.log(`::notice::SDK の更新があります（${installed} → ${selected}）`);
  writeFileSync(process.env.GITHUB_OUTPUT, `old=${installed}\nnew=${selected}\n`, { flag: 'a' });
}

function verifyCodexPackages(packages, expectedSdk) {
  assert.equal(packages[`node_modules/${SDK}`].version, expectedSdk, 'SDK の更新が lock に入っていません');
  const cli = packages[`node_modules/${CLI}`];
  assert.equal(cli?.version, expectedSdk, 'CLI の版が SDK と一致していません');
  for (const platform of CLI_PLATFORMS) {
    const name = `${CLI}-${platform}`;
    assert(cli.optionalDependencies?.[name], `CLI の依存に ${name} がありません`);
  }
  for (const name of Object.keys(cli.optionalDependencies).filter((name) => name.startsWith(`${CLI}-`))) {
    const platform = name.slice(CLI.length + 1);
    const version = `${expectedSdk}-${platform}`;
    assert.equal(cli.optionalDependencies[name], `npm:${CLI}@${version}`, `${name} の依存指定が一致していません`);
    assert.equal(packages[`node_modules/${name}`]?.version, version, `${name} の版が lock で一致していません`);
  }
}

function bump(expectedSdk, cliMetadataPath) {
  const { versions } = readPackageMetadata(cliMetadataPath);
  const cliProblem = registryVersionProblem(versions, expectedSdk);
  if (cliProblem) throw new Error(`選んだ SDK ${expectedSdk} と同じ版の ${CLI} は${cliProblem}`);

  const npm = readJson('package.json');
  const lock = readJson('package-lock.json');
  const tauriPath = 'src-tauri/tauri.conf.json';
  const tauri = readFileSync(tauriPath, 'utf8');
  const { version } = npm;
  const parts = STABLE.exec(version);
  assert(parts, `アプリの版が不正です: ${version}`);
  verifyCodexPackages(lock.packages, expectedSdk);
  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);
  assert.equal(JSON.parse(tauri).version, version);
  const next = `${parts[1]}.${parts[2]}.${BigInt(parts[3]) + 1n}`;

  const cargoPath = 'src-tauri/Cargo.toml';
  const cargo = readFileSync(cargoPath, 'utf8');
  const cargoLockPath = 'src-tauri/Cargo.lock';
  const cargoLock = readFileSync(cargoLockPath, 'utf8');
  const packageHeader = `[package]\nname = "${npm.name}"\n`;
  const lockHeader = `[[package]]\nname = "${npm.name}"\n`;
  const versionLine = `version = "${version}"\n`;
  assert(cargo.includes(packageHeader + versionLine), 'Cargo.toml の版が一致していません');
  assert(cargoLock.includes(lockHeader + versionLine), 'Cargo.lock の版が一致していません');

  npm.version = lock.version = lock.packages[''].version = next;
  writeJson('package.json', npm);
  writeJson('package-lock.json', lock);
  writeFileSync(tauriPath, tauri.replace(`"version": "${version}"`, `"version": "${next}"`));
  writeFileSync(cargoPath, cargo.replace(packageHeader + versionLine, `${packageHeader}version = "${next}"\n`));
  writeFileSync(cargoLockPath, cargoLock.replace(lockHeader + versionLine, `${lockHeader}version = "${next}"\n`));
  console.log(`v${next}`);
}

function verifyRelease(tag, repository, dir) {
  const release = readJson(join(dir, 'release.json'));
  const version = tag.slice(1);
  assert.equal(release.tag_name, tag);
  assert.equal(release.draft, true);
  assert.equal(release.prerelease, false);
  const windows = `agent-guild_windows-x64_${version}_x64-setup.exe`;
  const macos = 'agent-guild_macos-arm64_agent-guild.app.tar.gz';
  const signatureNames = [`${windows}.sig`, `${macos}.sig`];
  const expectedAssets = [
    windows,
    `agent-guild_macos-arm64_${version}_aarch64.dmg`,
    macos,
    ...signatureNames,
    'latest.json',
  ];
  assert.deepEqual(
    release.assets.map(({ name }) => name).sort(),
    expectedAssets.sort(),
    'リリースの添付が一致しません',
  );
  for (const asset of release.assets) {
    assert(asset.state === 'uploaded' && asset.size > 0, `添付が未完了または空です: ${asset.name}`);
  }

  const manifest = readJson(join(dir, 'latest.json'));
  assert.equal(versionProblem(tag, manifest.version), null);
  const signatures = Object.fromEntries(
    signatureNames.map((name) => {
      const signature = readFileSync(join(dir, name), 'utf8').trim();
      assert(signature, `署名が空です: ${name}`);
      return [name, signature];
    }),
  );
  const expected = buildManifest({ version, tag, repository, signatures, pubDate: manifest.pub_date });
  assert.deepEqual(manifest.platforms, expected.platforms, '更新先の URL または署名が添付と一致しません');
  console.log(`配布物6件と latest.json を確認しました（${tag}）`);
}

const {
  positionals: [command, ...args],
} = parseArgs({ allowPositionals: true });
switch (command) {
  case 'check':
    check(args[0]);
    break;
  case 'check-published-release':
    checkPublishedRelease(args[0]);
    break;
  case 'bump':
    bump(args[0], args[1]);
    break;
  case 'verify-release':
    verifyRelease(...args);
    break;
  default:
    throw new Error('使い方: codex-update.mjs check | check-published-release | bump | verify-release');
}
