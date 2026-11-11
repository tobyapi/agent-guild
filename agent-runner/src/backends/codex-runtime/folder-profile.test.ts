// 指定フォルダのチャンネルでの Codex の権限プロファイル。組み立ての検査（どの OS でも動く）と、
// 本物の Codex CLI の隔離（codex sandbox。モデルは呼ばない）での検査（Codex と MXC がある Windows だけ）。
import { spawnSync } from 'node:child_process';
import { link, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prepareCommandSandbox } from '../command-sandbox.ts';
import { runRequest } from '../run.test-support.ts';
import type { RunRequest } from '../types.ts';
import { findCodex } from './executable.ts';
import { FOLDER_PROFILE, folderOverrides, folderProfileScope, profileOverrides } from './folder-profile.ts';

const codex = findCodex();
const available = process.platform === 'win32' && codex !== null && (await prepareCommandSandbox());

describe('profileOverrides', () => {
  const overrides = profileOverrides({
    writable: ['C:\\data\\work', 'C:\\src\\プロジェクト'],
    readable: ['C:\\data\\peer'],
    denied: ['C:\\data\\peer\\MEMORY.md'],
    network: false,
  });

  it('MXC を使い、既定の権限プロファイルにする（sandbox_mode は使わない）', () => {
    expect(overrides).toContain('windows.sandbox="mxc"');
    expect(overrides).toContain(`default_permissions="${FOLDER_PROFILE}"`);
    expect(overrides.some((entry) => entry.startsWith('sandbox_mode'))).toBe(false);
  });

  it('読める場所・書ける場所・読ませない場所を、パスをキーにした表で渡す（区切りと日本語をそのまま保つ）', () => {
    const filesystem = overrides.find((entry) => entry.startsWith(`permissions.${FOLDER_PROFILE}.filesystem=`));
    expect(filesystem).toContain('":minimal" = "read"');
    expect(filesystem).toContain('"C:\\\\data\\\\work" = "write"');
    expect(filesystem).toContain('"C:\\\\src\\\\プロジェクト" = "write"');
    expect(filesystem).toContain('"C:\\\\data\\\\peer" = "read"');
    expect(filesystem).toContain('"C:\\\\data\\\\peer\\\\MEMORY.md" = "none"');
  });

  it('通信は、Web 閲覧の権限があるときだけ開く', () => {
    expect(overrides).toContain(`permissions.${FOLDER_PROFILE}.network={enabled = false}`);
    const open = profileOverrides({ writable: [], readable: [], denied: [], network: true });
    expect(open).toContain(`permissions.${FOLDER_PROFILE}.network={enabled = true}`);
  });
});

describe('指定フォルダの範囲', () => {
  let root: string;
  let request: RunRequest;
  const dir = (name: string) => join(root, name);

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'codex-folder-profile-')));
    for (const name of ['work', 'state', 'project', 'peer', 'outside']) await mkdir(dir(name));
    await writeFile(join(dir('project'), 'code.txt'), 'PROJECT-FILE');
    await writeFile(join(dir('peer'), 'artifact.txt'), 'PEER-ARTIFACT');
    await writeFile(join(dir('peer'), 'MEMORY.md'), 'PEER-MEMORY');
    await writeFile(join(dir('outside'), 'secret.txt'), 'OUTSIDE-SECRET');
    request = {
      ...runRequest('codex'),
      workspace: dir('work'),
      stateDir: dir('state'),
      readableDirs: [dir('peer'), dir('project'), dir('missing')],
      writableDirs: [dir('project')],
    };
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('書けるのは作業場所と割り当てフォルダ、読めるのは相談相手、相談相手の MEMORY.md は読ませない', async () => {
    const scope = await folderProfileScope(request, { PATH: '' });
    expect(scope.writable).toEqual([dir('work'), dir('project')]);
    expect(scope.readable).toEqual([dir('peer')]);
    expect(scope.denied).toEqual([join(dir('peer'), 'MEMORY.md')]);
    expect(scope.network).toBe(false);
  });

  it('指定フォルダでない依頼には何も足さず、隔離を使えない PC では実行しない', async () => {
    expect(await folderOverrides({ ...request, writableDirs: undefined })).toEqual([]);
    if (available) expect((await folderOverrides(request)).length).toBeGreaterThan(0);
    else if (!(await prepareCommandSandbox()) || process.platform !== 'win32') {
      await expect(folderOverrides(request)).rejects.toMatchObject({ code: 'unsupported_permission' });
    }
  });

  it.skipIf(!available)(
    '本物の Codex の隔離で、範囲の外は読めず書けず、相談相手のメモは読めず、通信もできない',
    async () => {
      // 割り当てフォルダの中のハードリンクは、OS の隔離では止められない（分かっている制約）
      await link(join(dir('outside'), 'secret.txt'), join(dir('project'), 'alias.txt'));
      const read = (label: string, path: string) =>
        `try { $t = Get-Content -LiteralPath '${path}' -Raw -ErrorAction Stop; "${label}: read ($($t.Trim()))" } catch { "${label}: denied" }`;
      const write = (label: string, path: string) =>
        `try { Set-Content -LiteralPath '${path}' -Value x -ErrorAction Stop; "${label}: written" } catch { "${label}: denied" }`;
      const script = [
        read('project', join(dir('project'), 'code.txt')),
        read('peer artifact', join(dir('peer'), 'artifact.txt')),
        read('peer MEMORY', join(dir('peer'), 'MEMORY.md')),
        read('outside', join(dir('outside'), 'secret.txt')),
        read('home', join(homedir(), '.gitconfig')),
        read('hardlink', join(dir('project'), 'alias.txt')),
        write('work', join(dir('work'), 'new.txt')),
        write('project', join(dir('project'), 'new.txt')),
        write('peer', join(dir('peer'), 'new.txt')),
        write('outside', join(dir('outside'), 'new.txt')),
        `try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('example.com', 443); 'network: allowed' } catch { 'network: blocked' }`,
      ].join('\n');
      await writeFile(join(dir('work'), 'probe.ps1'), `\uFEFF${script}`, 'utf8');
      const overrides = (await folderOverrides(request)).flatMap((entry) => ['-c', entry]);
      const shell = [
        'powershell.exe',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        'probe.ps1',
      ];
      const run = spawnSync(codex!.path, [...overrides, 'sandbox', '-P', FOLDER_PROFILE, '--', ...shell], {
        cwd: dir('work'),
        encoding: 'utf8',
        windowsHide: true,
      });
      expect(run.stdout.split(/\r?\n/).filter(Boolean)).toEqual([
        'project: read (PROJECT-FILE)',
        'peer artifact: read (PEER-ARTIFACT)',
        'peer MEMORY: denied',
        'outside: denied',
        'home: denied',
        'hardlink: read (OUTSIDE-SECRET)',
        'work: written',
        'project: written',
        'peer: denied',
        'outside: denied',
        'network: blocked',
      ]);
      expect(await readFile(join(dir('outside'), 'secret.txt'), 'utf8')).toBe('OUTSIDE-SECRET');
      await expect(readFile(join(dir('outside'), 'new.txt'))).rejects.toHaveProperty('code', 'ENOENT');
    },
    60_000,
  );
});
