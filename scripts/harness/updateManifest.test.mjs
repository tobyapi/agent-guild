// 自動アップデートの latest.json の組み立て（scripts/update-manifest.mjs）。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildManifest, updateTarget, versionProblem } from '../update-manifest.mjs';

const WINDOWS = 'agent-guild_windows-x64_0.2.0_x64-setup.exe.sig';
const MAC = 'agent-guild_macos-arm64_agent-guild.app.tar.gz.sig';
const base = { version: '0.2.0', tag: 'v0.2.0', repository: 'owner/repo', pubDate: '2026-11-12T00:00:00.000Z' };

test('タグとアプリの版が合っているかを確かめる', () => {
  assert.equal(versionProblem('v0.2.0', '0.2.0'), null);
  assert.match(versionProblem('v0.3.0', '0.2.0'), /合っていません/);
  assert.match(versionProblem('0.2.0', '0.2.0'), /合っていません/);
});

test('署名のファイル名から、対象名と配布物の名前を読む', () => {
  assert.deepEqual(updateTarget(WINDOWS), {
    platform: 'windows-x86_64',
    artifact: 'agent-guild_windows-x64_0.2.0_x64-setup.exe',
  });
  assert.deepEqual(updateTarget(MAC), {
    platform: 'darwin-aarch64',
    artifact: 'agent-guild_macos-arm64_agent-guild.app.tar.gz',
  });
  assert.equal(updateTarget('agent-guild_linux-x64_app.AppImage.sig'), null);
});

test('OS ごとの署名とダウンロード先を、リリースの URL で並べる', () => {
  const manifest = buildManifest({ ...base, signatures: { [WINDOWS]: 'sig-win\n', [MAC]: 'sig-mac\n' } });
  assert.deepEqual(manifest, {
    version: '0.2.0',
    notes: '',
    pub_date: '2026-11-12T00:00:00.000Z',
    platforms: {
      'windows-x86_64': {
        signature: 'sig-win',
        url: 'https://github.com/owner/repo/releases/download/v0.2.0/agent-guild_windows-x64_0.2.0_x64-setup.exe',
      },
      'darwin-aarch64': {
        signature: 'sig-mac',
        url: 'https://github.com/owner/repo/releases/download/v0.2.0/agent-guild_macos-arm64_agent-guild.app.tar.gz',
      },
    },
  });
});

test('署名がない・対象が分からない・同じ OS が重なるときは作らない', () => {
  assert.throws(() => buildManifest({ ...base, signatures: {} }), /署名（\*\.sig）がありません/);
  assert.throws(() => buildManifest({ ...base, signatures: { 'app.sig': 'x' } }), /どの OS 向け/);
  const twice = { [WINDOWS]: 'a', 'agent-guild_windows-x64_other.exe.sig': 'b' };
  assert.throws(() => buildManifest({ ...base, signatures: twice }), /2つあります/);
});
