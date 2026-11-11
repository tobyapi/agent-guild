// コマンドの隔離（Windows の MXC）を、本物の隔離で確かめる。使えない PC（古い Windows・ほかの OS・CI）では飛ばす。
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  commandSandboxReady,
  prepareCommandSandbox,
  runInSandbox,
  sandboxExecutable,
  type CommandScope,
} from './command-sandbox.ts';

const available = await prepareCommandSandbox();

describe('コマンドの隔離が使えるかの確認', () => {
  it('確かめた結果を覚えていて、Windows 以外では使わない', async () => {
    expect(commandSandboxReady()).toBe(available);
    expect(await prepareCommandSandbox()).toBe(available);
    if (process.platform !== 'win32') expect(available).toBe(false);
  });

  it('実行ファイルは環境変数で差し替えられ、無ければ見つからない扱いにする', () => {
    expect(sandboxExecutable({ GUILD_WXC_EXEC: join(tmpdir(), 'missing-wxc-exec.exe') })).toBeNull();
  });
});

describe.skipIf(!available)('隔離の中のコマンド（本物の MXC）', () => {
  let root: string;
  let scope: CommandScope;
  let stateDir: string;
  const run = (command: string, signal = new AbortController().signal, outputLimit = 32 * 1024) =>
    runInSandbox(scope, command, { signal, timeoutMs: 30_000, outputLimit, stateDir });
  const lines = (result: string) => result.split(/\r?\n/).filter(Boolean);

  beforeAll(() => {
    vi.stubEnv('GUILD_TEST_API_TOKEN', 'parent-secret-value');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'guild-command-sandbox-')));
    stateDir = join(root, 'state');
    scope = { cwd: join(root, 'work'), writable: [join(root, 'work')], readable: [join(root, 'peer')], home: '' };
    scope.home = join(stateDir, 'command-home');
    for (const dir of ['work', 'peer', 'outside', 'state']) await mkdir(join(root, dir));
    await writeFile(join(root, 'peer', 'artifact.txt'), 'shared artifact');
    await writeFile(join(root, 'outside', 'secret.txt'), 'OUTSIDE-SECRET');
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('作業場所の中では読み書きでき、終了コードと出力（日本語も）を返す', async () => {
    const result = await run('Set-Content note.txt "メモ"; Get-Content note.txt; cmd.exe /d /c exit 3');
    expect(lines(result)).toEqual(['exit=3', 'メモ']);
    // Windows PowerShell の UTF-8 は先頭に BOM が付く
    const written = await readFile(join(root, 'work', 'note.txt'), 'utf8');
    expect(written.charCodeAt(0)).toBe(0xfeff);
    expect(written.slice(1).trim()).toBe('メモ');
    expect(lines(await run('Get-Content missing.txt'))[0]).toBe('exit=1');
  }, 60_000);

  it('読み取りだけの場所は読めるが書けず、範囲の外は読みも書きもできない', async () => {
    const peer = join(root, 'peer', 'artifact.txt');
    const outside = join(root, 'outside');
    const result = await run(
      [
        `Get-Content "${peer}"`,
        `try { Set-Content "${peer}" x -ErrorAction Stop; 'peer write: allowed' } catch { 'peer write: denied' }`,
        `try { Get-Content "${join(outside, 'secret.txt')}" -ErrorAction Stop; 'outside read: allowed' } catch { 'outside read: denied' }`,
        `try { Set-Content "${join(outside, 'new.txt')}" x -ErrorAction Stop; 'outside write: allowed' } catch { 'outside write: denied' }`,
        `try { Set-Content (Join-Path $env:USERPROFILE 'home.txt') x -ErrorAction Stop; 'home write: allowed' } catch { 'home write: denied' }`,
        `$env:USERPROFILE`,
      ].join('\n'),
    );
    expect(lines(result).slice(0, 6)).toEqual([
      'exit=0',
      'shared artifact',
      'peer write: denied',
      'outside read: denied',
      'outside write: denied',
      'home write: allowed',
    ]);
    // ホームは隔離の中専用（利用者の本物のホームではない）
    expect(lines(result)[6]).toBe(scope.home);
    expect(await readFile(join(root, 'peer', 'artifact.txt'), 'utf8')).toBe('shared artifact');
    await expect(readFile(join(outside, 'new.txt'))).rejects.toHaveProperty('code', 'ENOENT');
  }, 60_000);

  it('範囲の外のフォルダは中の名前も一覧できず、見えるのは親フォルダの直下の名前だけ', async () => {
    await mkdir(join(root, 'outside', 'deep'));
    const probe = (label: string, path: string) =>
      `try { $names = @(Get-ChildItem -LiteralPath "${path}" -Name -ErrorAction Stop); "${label}: $($names -join ',')" } catch { "${label}: denied" }`;
    const result = await run(
      [
        probe('outside', join(root, 'outside')),
        probe('deep', join(root, 'outside', 'deep')),
        probe('documents', join(homedir(), 'Documents')),
        probe('parent', root),
      ].join('\n'),
    );
    expect(lines(result)).toEqual([
      'exit=0',
      'outside: denied',
      'deep: denied',
      'documents: denied',
      'parent: outside,peer,state,work',
    ]);
  }, 60_000);

  it('作業場所のスクリプト（.ps1）を動かせる（実行ポリシーの確認で止まらない）', async () => {
    await writeFile(join(root, 'work', 'hello.ps1'), '"script ok"');
    expect(lines(await run('& (Join-Path (Get-Location) hello.ps1)'))).toEqual(['exit=0', 'script ok']);
  }, 60_000);

  it('通信はできず、秘密らしい環境変数は渡らない', async () => {
    const result = await run(
      [
        `try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('example.com', 443); 'network: allowed' } catch { 'network: blocked' }`,
        `if ($env:GUILD_TEST_API_TOKEN) { 'secret env: visible' } else { 'secret env: hidden' }`,
        `if ($env:PATH) { 'PATH: passed' } else { 'PATH: missing' }`,
      ].join('\n'),
    );
    expect(lines(result)).toEqual(['exit=0', 'network: blocked', 'secret env: hidden', 'PATH: passed']);
  }, 60_000);

  it('出力が上限を超えたら止め、中断したら実行中のコマンドも終わらせる', async () => {
    await expect(
      run('1..5000 | ForEach-Object { "line $_ ........................" }', undefined, 2048),
    ).rejects.toThrow('上限');
    const controller = new AbortController();
    const started = Date.now();
    const pending = run('Start-Sleep 25; Set-Content late.txt x', controller.signal);
    setTimeout(() => controller.abort(), 1500);
    await expect(pending).rejects.toHaveProperty('code', 'cancelled');
    expect(Date.now() - started).toBeLessThan(15_000);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await expect(readFile(join(root, 'work', 'late.txt'))).rejects.toHaveProperty('code', 'ENOENT');
  }, 60_000);

  it('設定ファイルを残さず、長すぎるコマンドは実行前に断る', async () => {
    await run('"ok"');
    const { readdir } = await import('node:fs/promises');
    expect(await readdir(join(stateDir, 'command-sandbox'))).toEqual([]);
    await expect(run('x'.repeat(8001))).rejects.toHaveProperty('code', 'bad_request');
  }, 60_000);
});
