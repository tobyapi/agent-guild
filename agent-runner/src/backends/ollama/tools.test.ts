import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runRequest } from '../run.test-support.ts';
import { executeTool, sandbox, sandboxProcess, seatbeltProfile, toolNames } from './tools.ts';

const dirs: string[] = [];
afterEach(async () => {
  for (const path of dirs.splice(0)) await rm(path, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'ollama-tools-'));
  dirs.push(root);
  const workspace = join(root, 'work');
  const stateDir = join(root, 'state');
  await mkdir(workspace);
  await mkdir(stateDir);
  return { ...runRequest('ollama'), workspace, stateDir, options: { enableTools: true, operationCheck: false } };
}

describe('Ollama tools', () => {
  it('ファイル権限がなければMEMORY専用の読み書きとスキル・投稿だけを提示する', () => {
    const request = runRequest('ollama');
    request.permissions.readFiles = false;
    request.permissions.writeFiles = false;
    expect(toolNames(request)).toEqual(['read_file', 'write_file', 'read_skill', 'post']);
  });
  it('write_file は空または空白だけの content を拒否する', async () => {
    const request = await fixture();
    const prepared = { profile: '', workspace: request.workspace, isolated: false, container: false };
    for (const content of ['', '  \n\t']) {
      await expect(
        executeTool(request, 'write_file', { path: 'empty.txt', content }, new AbortController().signal, prepared),
      ).rejects.toThrow('書き込む内容が空です');
    }
  });
  it('Seatbelt は既定拒否・書き込み範囲限定・ネットワーク拒否・管理領域保護', () => {
    const request = runRequest('ollama');
    const profile = seatbeltProfile(request, '/work', ['/extra'], '/state');
    expect(profile).toContain('(deny default)');
    expect(profile).not.toContain('process-fork');
    expect(profile).toContain('(allow file-write* (subpath "/work"))');
    expect(profile).toContain('(deny file-write* (subpath "/state"))');
    expect(profile).not.toContain('(allow network*)');
    request.permissions.webFetch = true;
    request.permissions.webSearch = true;
    expect(seatbeltProfile(request, '/work', [], '/state')).not.toContain('(allow network*)');
  });
  it.skipIf(process.platform !== 'darwin')(
    '実際の Seatbelt 内で読み書きし、../ と symlink と外部書き込みを拒否する',
    async () => {
      const request = await fixture();
      const prepared = await sandbox(request);
      const signal = new AbortController().signal;
      await executeTool(request, 'write_file', { path: 'hello', content: 'hello' }, signal, prepared);
      expect(await readFile(join(request.workspace, 'hello'), 'utf8')).toBe('hello');
      expect(await executeTool(request, 'read_file', { path: 'hello' }, signal, prepared)).toContain('hello');
      await writeFile(join(request.stateDir, 'secret'), 'secret');
      await symlink(request.stateDir, join(request.workspace, 'escape'));
      await expect(executeTool(request, 'read_file', { path: 'escape/secret' }, signal, prepared)).rejects.toThrow(
        '外',
      );
      await expect(
        executeTool(request, 'write_file', { path: '../outside', content: 'bad' }, signal, prepared),
      ).rejects.toThrow('外');
      const result = await executeTool(request, 'run_command', { command: 'echo bad > ../outside' }, signal, prepared);
      expect(result).not.toContain('exit=0');
      await expect(readFile(join(request.workspace, '../outside'))).rejects.toThrow();
      // 読み取り可能な外部フォルダのファイルも、シェルから書き換えられない。
      const network = await executeTool(
        request,
        'run_command',
        { command: '/usr/bin/curl --max-time 1 http://127.0.0.1:11434' },
        signal,
        prepared,
      );
      expect(network).not.toContain('exit=0');
    },
  );
  it.skipIf(process.platform !== 'darwin')('未知の道具・大きすぎる出力・中断を拒否する', async () => {
    const request = await fixture();
    const prepared = await sandbox(request);
    await expect(executeTool(request, 'unknown', {}, new AbortController().signal, prepared)).rejects.toThrow('許可');
    await expect(
      sandboxProcess(prepared.profile, prepared.workspace, '/usr/bin/yes', [], new AbortController().signal),
    ).rejects.toThrow('32KiB');
    const controller = new AbortController();
    const pending = sandboxProcess(prepared.profile, prepared.workspace, '/bin/sleep', ['30'], controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  });
});

it.skipIf(process.platform !== 'darwin')('管理領域の祖先renameとhardlink経由の書き込みをOSで拒否する', async () => {
  const request = await fixture();
  request.permissions.writeAnywhere = true;
  request.readableDirs = [request.stateDir];
  const root = join(request.workspace, '..');
  await writeFile(join(request.stateDir, 'secret'), 'original');
  const prepared = await sandbox(request);
  const signal = new AbortController().signal;
  await executeTool(request, 'write_file', { path: 'normal', content: 'ok' }, signal, prepared);
  expect(await readFile(join(request.workspace, 'normal'), 'utf8')).toBe('ok');
  const rename = await executeTool(
    request,
    'run_command',
    { command: `/bin/mv "${root}" "${root}-moved"` },
    signal,
    prepared,
  );
  expect(rename).not.toContain('exit=0');
  const linked = await executeTool(
    request,
    'run_command',
    { command: `/bin/ln "${request.stateDir}/secret" "${request.workspace}/alias"` },
    signal,
    prepared,
  );
  expect(linked).not.toContain('exit=0');
  expect(await readFile(join(request.stateDir, 'secret'), 'utf8')).toBe('original');
});

it.skipIf(process.platform !== 'darwin')('読み取り専用の追加フォルダからhardlinkを作って書き換えられない', async () => {
  const request = await fixture();
  const extra = join(request.workspace, '../extra');
  await mkdir(extra);
  await writeFile(join(extra, 'original'), 'keep');
  request.readableDirs = [extra];
  const prepared = await sandbox(request);
  const signal = new AbortController().signal;
  const result = await executeTool(
    request,
    'run_command',
    { command: `/bin/ln "${extra}/original" "${request.workspace}/alias"` },
    signal,
    prepared,
  );
  expect(result).not.toContain('exit=0');
  expect(await readFile(join(extra, 'original'), 'utf8')).toBe('keep');
});

it.skipIf(process.platform !== 'darwin')('単一コマンドは実行でき、forkと時間超過は拒否する', async () => {
  const request = await fixture();
  const prepared = await sandbox(request);
  const signal = new AbortController().signal;
  expect(await executeTool(request, 'run_command', { command: '/bin/echo ready' }, signal, prepared)).toContain(
    'exit=0\nready',
  );
  const pipeline = await executeTool(request, 'run_command', { command: 'echo hello | /bin/cat' }, signal, prepared);
  expect(pipeline).not.toContain('exit=0');
  vi.useFakeTimers();
  try {
    const pending = sandboxProcess(prepared.profile, prepared.workspace, '/bin/sleep', ['60'], signal);
    const rejected = expect(pending).rejects.toThrow('30秒');
    await vi.advanceTimersByTimeAsync(30_000);
    await rejected;
  } finally {
    vi.useRealTimers();
  }
});
