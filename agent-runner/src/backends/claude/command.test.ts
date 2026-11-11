// 作業者以外の役割のコマンド: 隔離が使える PC でだけ、内蔵の Bash の代わりに、隔離の中で動く道具を渡す。
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import cases from '../../../../contracts/behavior/role-permissions.json' with { type: 'json' };
import type { Permissions } from '../../protocol.ts';
import { prepareCommandSandbox } from '../command-sandbox.ts';
import { runRequest } from '../run.test-support.ts';
import { usablePermissions, type RunRequest } from '../types.ts';
import { claudeAdapter } from '../claude.ts';
import { COMMAND_TOOL, handleCommand } from './command.ts';
import { claudeOptions } from './options.ts';
import { POST_TOOL } from './post.ts';
import { commandMode, permissionRules, unenforceableReason } from './rules.ts';
import { registeredToolResult, registeredToolsHook, toolsFor } from './tool-policy.ts';

const role = (name: string): Permissions => cases.find((row) => row.name === `${name} / claude`)!.permissions;
const WORKER = role('作業者');
const ROLES = ['発想役', '専門家', 'マネージャー'];
const available = await prepareCommandSandbox();

describe('コマンドの渡し方（隔離の有無を引数で指定）', () => {
  it('作業者は内蔵の Bash、ほかの役割は隔離があるときだけ隔離の中の道具、なければ渡さない', () => {
    expect(commandMode(WORKER, false)).toBe('bash');
    expect(commandMode(WORKER, true)).toBe('bash');
    for (const name of ROLES) {
      expect(commandMode(role(name), true), name).toBe('sandbox');
      expect(commandMode(role(name), false), name).toBe('none');
    }
    expect(commandMode({ ...role('専門家'), runCommands: false }, true)).toBe('none');
  });

  it('隔離があれば、コマンドの規則は申告しない（隔離がなければ、全部を許す役割でだけ使える）', () => {
    expect(permissionRules(false).map((rule) => rule.when)).toEqual(['writeAnywhere', 'runCommands']);
    expect(permissionRules(true).map((rule) => rule.when)).toEqual(['writeAnywhere']);
    for (const name of ROLES) {
      const info = { ...claudeAdapter.info(), permissionRules: permissionRules(true) };
      const usable = usablePermissions(role(name), info);
      expect(usable, name).toEqual(role(name));
      expect(unenforceableReason(usable, true)).toBeNull();
      // 隔離がなければ、これまでどおりコマンドだけを外す
      const without = usablePermissions(role(name), { ...info, permissionRules: permissionRules(false) });
      expect(without, name).toEqual({ ...role(name), runCommands: false });
      expect(unenforceableReason(role(name), false)).toContain('コマンド');
    }
  });

  it('隔離があっても、役割にない操作（外への書き込み・Web）は増えない', () => {
    for (const name of ROLES) {
      const usable = usablePermissions(role(name), { ...claudeAdapter.info(), permissionRules: permissionRules(true) });
      expect(usable).toMatchObject({ writeAnywhere: false, webFetch: false, webSearch: false });
    }
  });
});

describe.skipIf(!available)('隔離が使える PC での Claude の道具（本物の MXC）', () => {
  let root: string;
  const request = (name: string): RunRequest => ({
    ...runRequest('claude'),
    workspace: join(root, 'work'),
    stateDir: join(root, 'state'),
    readableDirs: [join(root, 'peer')],
    permissions: role(name),
  });
  const run = () => ({
    abortController: new AbortController(),
    pluginDir: null,
    onPost: vi.fn(),
    onUsage: vi.fn(),
    executable: 'unused',
  });
  const text = (result: { content: { text: string }[] }) => result.content[0]!.text;

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'claude-command-')));
    for (const dir of ['work', 'peer', 'outside', 'state']) await mkdir(join(root, dir));
    await writeFile(join(root, 'peer', 'artifact.txt'), 'shared artifact');
    await writeFile(join(root, 'outside', 'secret.txt'), 'OUTSIDE-SECRET');
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.each(ROLES)('%s: Bash は渡さず、隔離の中のコマンドの道具を確認なしで使えるようにする', (name) => {
    const req = request(name);
    expect(claudeAdapter.info().permissionRules.map((rule) => rule.when)).toEqual(['writeAnywhere']);
    expect(usablePermissions(req.permissions, claudeAdapter.info())).toEqual(req.permissions);
    expect(toolsFor(req.permissions)).not.toContain('Bash');
    const options = claudeOptions(req, run());
    expect(options.tools).not.toContain('Bash');
    expect(options.allowedTools).toEqual(expect.arrayContaining([POST_TOOL, COMMAND_TOOL]));
    expect(registeredToolResult(COMMAND_TOOL, req.permissions, {})).toMatchObject({ behavior: 'allow' });
    expect(registeredToolResult('Bash', req.permissions, {})).toBeNull();
  });

  it('作業者には、これまでどおり内蔵の Bash を渡す（隔離の中の道具は渡さない）', () => {
    const options = claudeOptions({ ...request('作業者'), permissions: WORKER }, run());
    expect(options.tools).toContain('Bash');
    expect(options.allowedTools).not.toContain(COMMAND_TOOL);
    expect(registeredToolResult(COMMAND_TOOL, WORKER, {})).toBeNull();
  });

  it('コマンドの道具は、アプリが作った guild サーバーのものだけを通す', async () => {
    const hook = registeredToolsHook([COMMAND_TOOL]);
    const call = (source?: string) =>
      hook(
        {
          hook_event_name: 'PreToolUse',
          tool_name: COMMAND_TOOL,
          tool_input: {},
          ...(source ? { mcp_server: { source, name: 'guild' } } : {}),
        } as Parameters<typeof hook>[0],
        'tool-1',
        { signal: new AbortController().signal },
      );
    expect(await call('sdk')).toEqual({});
    for (const source of ['claudeai', 'user', 'plugin', undefined]) {
      expect(await call(source)).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
    }
  });

  it('専門家のコマンドは作業フォルダに書け、相談元は読めるだけ、範囲の外と通信は使えない', async () => {
    const outside = join(root, 'outside');
    const result = await handleCommand(
      request('専門家'),
      [
        'Set-Content result.txt done; Get-Content result.txt',
        `Get-Content "${join(root, 'peer', 'artifact.txt')}"`,
        `try { Get-Content "${join(outside, 'secret.txt')}" -ErrorAction Stop; 'outside read: allowed' } catch { 'outside read: denied' }`,
        `try { Set-Content "${join(outside, 'x.txt')}" x -ErrorAction Stop; 'outside write: allowed' } catch { 'outside write: denied' }`,
        `try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('example.com', 443); 'network: allowed' } catch { 'network: blocked' }`,
      ].join('\n'),
      new AbortController().signal,
    );
    expect(result.isError).toBeUndefined();
    expect(text(result).split(/\r?\n/).filter(Boolean)).toEqual([
      '終了コード: 0',
      'done',
      'shared artifact',
      'outside read: denied',
      'outside write: denied',
      'network: blocked',
    ]);
    expect((await readFile(join(root, 'work', 'result.txt'), 'utf8')).slice(1).trim()).toBe('done');
    await expect(readFile(join(outside, 'x.txt'))).rejects.toHaveProperty('code', 'ENOENT');
  }, 60_000);

  it('終了コードをそのまま返し、空のコマンドと動かせなかった場合はエラーとして返す', async () => {
    const signal = new AbortController().signal;
    expect(text(await handleCommand(request('発想役'), 'cmd.exe /d /c exit 4', signal))).toContain('終了コード: 4');
    expect(await handleCommand(request('発想役'), '  ', signal)).toMatchObject({ isError: true });
    const tooLong = await handleCommand(request('発想役'), 'x'.repeat(9000), signal);
    expect(tooLong).toMatchObject({ isError: true });
    expect(text(tooLong)).toContain('コマンドを実行できませんでした');
  }, 60_000);
});
