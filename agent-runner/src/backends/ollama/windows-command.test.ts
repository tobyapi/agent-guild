// Windows での Ollama のコマンド: 共通の隔離（MXC）の中で動くこと。隔離が使えない PC（古い Windows・CI）では飛ばす。
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareCommandSandbox } from '../command-sandbox.ts';
import { ollamaAdapter } from '../ollama.ts';
import { runContext, runRequest } from '../run.test-support.ts';
import { usablePermissions } from '../types.ts';
import { runLocalCommand } from './command.ts';
import { localHttp } from './http.ts';
import { toolNames } from './tools.ts';

vi.mock('./http.ts', () => ({ localHttp: vi.fn() }));
const http = vi.mocked(localHttp);
const available = process.platform === 'win32' && (await prepareCommandSandbox());

describe.skipIf(!available)('Windows の隔離の中での Ollama のコマンド', () => {
  let root: string;
  const signal = new AbortController().signal;
  const request = () => ({
    ...runRequest('ollama'),
    options: { enableTools: true, operationCheck: false },
    workspace: join(root, 'work'),
    stateDir: join(root, 'state'),
    readableDirs: [join(root, 'peer')],
  });
  const command = async (text: string, req = request()) =>
    JSON.parse(await runLocalCommand(req, text, signal)) as { exitCode: number; output: string };

  beforeEach(async () => {
    http.mockReset();
    root = await realpath(await mkdtemp(join(tmpdir(), 'ollama-windows-command-')));
    for (const dir of ['work', 'peer', 'outside']) await mkdir(join(root, dir));
    await writeFile(join(root, 'work', 'in.txt'), 'inside');
    await writeFile(join(root, 'peer', 'artifact.txt'), 'shared artifact');
    await writeFile(join(root, 'outside', 'secret.txt'), 'OUTSIDE-SECRET');
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('隔離が使える PC では、コマンドを使える操作として申告する（外への書き込みは使わない）', () => {
    const { capabilities } = ollamaAdapter.info();
    expect(capabilities).toMatchObject({ runCommands: true, writeAnywhere: false, readFiles: true, writeFiles: true });
    expect(toolNames(request())).toContain('run_command');
    const worker = { ...request().permissions, webSearch: true, webFetch: true, writeAnywhere: true };
    expect(usablePermissions(worker, ollamaAdapter.info())).toMatchObject({
      runCommands: true,
      writeAnywhere: false,
      webFetch: false,
    });
  });

  it('作業場所で読み書きでき、相談元は読めるだけ、範囲の外と通信は使えない', async () => {
    const outside = join(root, 'outside');
    const result = await command(
      [
        'Get-Content in.txt',
        'Set-Content result.txt done; Get-Content result.txt',
        `Get-Content "${join(root, 'peer', 'artifact.txt')}"`,
        `try { Set-Content "${join(root, 'peer', 'x.txt')}" x -ErrorAction Stop; 'peer write: allowed' } catch { 'peer write: denied' }`,
        `try { Get-Content "${join(outside, 'secret.txt')}" -ErrorAction Stop; 'outside read: allowed' } catch { 'outside read: denied' }`,
        `try { Set-Content "${join(outside, 'x.txt')}" x -ErrorAction Stop; 'outside write: allowed' } catch { 'outside write: denied' }`,
        `try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('example.com', 443); 'network: allowed' } catch { 'network: blocked' }`,
      ].join('\n'),
    );
    expect(result.exitCode).toBe(0);
    expect(result.output.split(/\r?\n/).filter(Boolean)).toEqual([
      'inside',
      'done',
      'shared artifact',
      'peer write: denied',
      'outside read: denied',
      'outside write: denied',
      'network: blocked',
    ]);
    await expect(readFile(join(outside, 'x.txt'))).rejects.toHaveProperty('code', 'ENOENT');
  }, 60_000);

  it('書き込みの権限がない役割では、コマンドからも作業場所に書けない（読むことはできる）', async () => {
    const req = request();
    req.permissions.writeFiles = false;
    const result = await command(
      "Get-Content in.txt; try { Set-Content denied.txt x -ErrorAction Stop; 'write: allowed' } catch { 'write: denied' }",
      req,
    );
    expect(result.output.split(/\r?\n/).filter(Boolean)).toEqual(['inside', 'write: denied']);
    await expect(readFile(join(root, 'work', 'denied.txt'))).rejects.toHaveProperty('code', 'ENOENT');
  }, 60_000);

  it('モデルが JSON 操作で頼んだコマンドを隔離の中で実行し、結果をモデルへ返す', async () => {
    const reply = (body: object) => http.mockResolvedValueOnce({ status: 200, text: JSON.stringify(body) });
    const action = (body: object) => reply({ message: { content: JSON.stringify(body) } });
    reply({ models: [{ model: 'deepseek-r1:8b', capabilities: ['completion', 'thinking'] }] });
    action({ type: 'tool', tool: 'run_command', command: 'Set-Content built.txt ok; Get-Content built.txt' });
    action({ type: 'final', text: '実行しました' });
    await expect(ollamaAdapter.run(request(), runContext())).resolves.toBe('実行しました');
    expect((await readFile(join(root, 'work', 'built.txt'), 'utf8')).slice(1).trim()).toBe('ok');
    const sent = http.mock.calls[2]?.[2] ?? '';
    expect(sent).toContain('exitCode');
    expect(sent).toContain('Windows PowerShell');
  }, 60_000);
});
