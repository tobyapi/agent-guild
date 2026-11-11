// パスの「形」とリンクで許した範囲を抜けられないこと、Windows・Linux の秘密の場所を読めないことの検査。
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { checkedPolicy } from './check.ts';
import { claudeOptions } from './options.ts';
import { fileAccessHook, fileAccessPolicy } from './permissions.ts';
import { call, fixture, home, outside, peer, read, request, root, workspace } from './secret-read.test-support.ts';

vi.mock('node:os', async (original) => ({ ...(await original<typeof import('node:os')>()), homedir: () => home }));

const ROLES = ['作業者', '専門家', '発想役', 'マネージャー'];
const policies = (role: string) => {
  const req = request(role);
  return [fileAccessPolicy(req), checkedPolicy(req, vi.fn().mockResolvedValue({ allow: true, reason: '' }), vi.fn())];
};

const OTHER_OS_SECRETS = [
  'AppData/Roaming/Microsoft/Credentials/blob',
  'AppData/Roaming/Microsoft/Protect/S-1-5-21/key',
  'AppData/Roaming/Microsoft/Windows/PowerShell/PSReadLine/ConsoleHost_history.txt',
  'AppData/Roaming/Mozilla/Firefox/Profiles/x/logins.json',
  'AppData/Roaming/gcloud/credentials.db',
  'AppData/Roaming/GitHub CLI/hosts.yml',
  'AppData/Roaming/com.agentguild.app/settings.json',
  'AppData/Local/Google/Chrome/User Data/Default/Login Data',
  'AppData/Local/Microsoft/Edge/User Data/Default/Cookies',
  'AppData/Local/BraveSoftware/Brave-Browser/User Data/Default/Cookies',
  'AppData/Local/Microsoft/Credentials/blob',
  'AppData/Local/com.agentguild.app/EBWebView/Default/Cookies',
  'AppData/Local/com.agentguild.app/logs/agent-guild.log',
  '_netrc',
  '.config/google-chrome/Default/Cookies',
  '.config/com.agentguild.app/settings.json',
  '.mozilla/firefox/x/logins.json',
  '.local/share/keyrings/login.keyring',
  '.cargo/credentials.toml',
];
const APP_WORK = 'AppData/Local/com.agentguild.app/data/agents/a2/work/report.md';

beforeAll(async () => {
  for (const path of [...OTHER_OS_SECRETS, APP_WORK]) await fixture(join(home, path));
  await fixture(join(workspace, 'notes.md'), 'notes');
});

describe('Windows・Linux の秘密の場所', () => {
  it.each(OTHER_OS_SECRETS)('readAnywhere でも %s は読めない', async (path) => {
    for (const role of ['専門家', 'マネージャー']) {
      expect(await read(join(home, path), role)).toMatchObject({ behavior: 'deny' });
    }
  });

  it('アプリのデータフォルダの中の作業場所は除外しない', async () => {
    expect(await read(join(home, APP_WORK))).toMatchObject({ behavior: 'allow' });
  });

  it('APPDATA・LOCALAPPDATA で移した場所も除外する', async () => {
    vi.stubEnv('APPDATA', join(root, 'roaming'));
    vi.stubEnv('LOCALAPPDATA', join(root, 'local'));
    await fixture(join(root, 'roaming/Microsoft/Credentials/blob'));
    await fixture(join(root, 'local/Google/Chrome/User Data/Default/Login Data'));
    expect(await read(join(root, 'roaming/Microsoft/Credentials/blob'))).toMatchObject({ behavior: 'deny' });
    expect(await read(join(root, 'local/Google/Chrome/User Data/Default/Login Data'))).toMatchObject({
      behavior: 'deny',
    });
    const search = await call(fileAccessPolicy(request()), 'Grep', { pattern: 'x', path: join(root, 'local') });
    expect(search).toMatchObject({ behavior: 'deny' });
  });
});

describe('判定するパスと道具が使うパスの食い違い', () => {
  it.each(ROLES)('%s: 道具が使わないパスの項目つきの呼び出しを拒否する', async (role) => {
    for (const policy of policies(role)) {
      const grep = await call(policy, 'Grep', { pattern: 'x', file_path: workspace, path: join(home, '.ssh') });
      expect(grep).toMatchObject({ behavior: 'deny' });
      const readCall = await call(policy, 'Read', { file_path: join(workspace, 'notes.md'), path: join(home, '.ssh') });
      expect(readCall).toMatchObject({ behavior: 'deny' });
      expect(await call(policy, 'Read', { file_path: join(workspace, 'notes.md') })).toMatchObject({
        behavior: 'allow',
      });
    }
  });
});

describe('リンクを通じた範囲外の読み取り（readAnywhere のない役割）', () => {
  const scoped = () => {
    const req = request('発想役');
    return { ...req, permissions: { ...req.permissions, readAnywhere: false, writeAnywhere: false } };
  };

  it('作業場所の中のリンクが外を指していたら読めない', async () => {
    for (const policy of [fileAccessPolicy(scoped()), checkedPolicy(scoped(), vi.fn(), vi.fn())]) {
      const linked = join(workspace, 'secret-link');
      expect(await call(policy, 'Read', { file_path: join(linked, 'config') })).toMatchObject({ behavior: 'deny' });
      expect(await call(policy, 'Grep', { pattern: 'Host', path: linked })).toMatchObject({ behavior: 'deny' });
      expect(await call(policy, 'Read', { file_path: join(workspace, 'notes.md') })).toMatchObject({
        behavior: 'allow',
      });
      expect(await call(policy, 'Read', { file_path: join(peer, 'missing.md') })).toMatchObject({ behavior: 'allow' });
    }
  });

  it('MEMORY.md が外へのリンクなら、読み書きの例外にしない', async () => {
    const req = { ...scoped(), workspace: join(root, 'memory-link-work') };
    await fixture(join(root, 'memory-link-target.md'), 'outside');
    await fixture(join(req.workspace, 'keep.md'));
    const { symlink } = await import('node:fs/promises');
    await symlink(join(root, 'memory-link-target.md'), join(req.workspace, 'MEMORY.md'));
    const policy = fileAccessPolicy({ ...req, permissions: { ...req.permissions, readFiles: false } });
    const memory = join(req.workspace, 'MEMORY.md');
    expect(await call(policy, 'Read', { file_path: memory })).toMatchObject({ behavior: 'deny' });
    expect(await call(policy, 'Write', { file_path: memory, content: 'x' })).toMatchObject({ behavior: 'deny' });
  });
});

describe('Glob の pattern で起点の外を一覧させない（writeAnywhere のない役割）', () => {
  it.each(['../../**/*', '{.,x}{.,x}/**', '../peer/.env'])('pattern %s を拒否する', async (pattern) => {
    for (const role of ['専門家', '発想役', 'マネージャー']) {
      for (const policy of policies(role)) {
        for (const path of [undefined, workspace, outside]) {
          const result = await call(policy, 'Glob', { pattern, ...(path ? { path } : {}) });
          expect(result).toMatchObject({ behavior: 'deny' });
        }
      }
    }
  });

  it('普通の pattern は引き続き通る', async () => {
    for (const policy of policies('発想役')) {
      expect(await call(policy, 'Glob', { pattern: '**/*.{md,txt}', path: workspace })).toMatchObject({
        behavior: 'allow',
      });
    }
  });
});

describe('canUseTool が呼ばれない呼び出し（PreToolUse のフック）', () => {
  const hookCall = (hook: ReturnType<typeof fileAccessHook>, tool: string, input: Record<string, unknown>) =>
    hook(
      { hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input } as Parameters<typeof hook>[0],
      'tool-1',
      { signal: new AbortController().signal },
    );
  const denied = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny' } };

  it.each(['発想役', '専門家'])('%s: 作業場所の中から外を指す呼び出しを拒否し、許可は返さない', async (role) => {
    const hook = fileAccessHook(request(role));
    expect(await hookCall(hook, 'Glob', { pattern: '../../**/*' })).toMatchObject(denied);
    expect(await hookCall(hook, 'Read', { file_path: join(workspace, 'secret-link', 'config') })).toMatchObject(denied);
    expect(
      await hookCall(hook, 'Grep', { pattern: 'x', file_path: workspace, path: join(home, '.ssh') }),
    ).toMatchObject(denied);
    expect(await hookCall(hook, 'Read', { file_path: join(workspace, 'notes.md') })).toEqual({});
    expect(await hookCall(hook, 'Glob', { pattern: '**/*.md' })).toEqual({});
    expect(await hookCall(hook, 'Bash', { command: 'ls' })).toEqual({});
    expect(await hookCall(hook, 'WebSearch', { query: 'x' })).toEqual({});
  });

  it('通常実行のオプションに、登録の確認のあとに入っている', async () => {
    const sdk = claudeOptions(request('発想役'), {
      abortController: new AbortController(),
      pluginDir: null,
      onPost: vi.fn(),
      onUsage: vi.fn(),
      executable: 'unused',
    });
    const hooks = sdk.hooks!.PreToolUse![0]!.hooks;
    expect(hooks).toHaveLength(2);
    expect(await hookCall(hooks[1]!, 'Glob', { pattern: '../../**/*' })).toMatchObject(denied);
  });
});

describe.runIf(process.platform === 'win32')('Windows が特別に解釈するパス', () => {
  it.each(ROLES)('%s: ネットワークパスと代替データストリームを読み書きしない', async (role) => {
    for (const policy of policies(role)) {
      const unc = '\\\\attacker.example\\share\\probe.txt';
      expect(await call(policy, 'Read', { file_path: unc })).toMatchObject({ behavior: 'deny' });
      expect(await call(policy, 'Grep', { pattern: 'x', path: '\\\\attacker.example\\share' })).toMatchObject({
        behavior: 'deny',
      });
      expect(await call(policy, 'Write', { file_path: unc, content: 'x' })).toMatchObject({ behavior: 'deny' });
      const stream = `${join(outside, 'README.md')}::$DATA`;
      expect(await call(policy, 'Read', { file_path: stream })).toMatchObject({ behavior: 'deny' });
      const device = `\\\\?\\${join(home, '.ssh', 'config')}`;
      expect(await call(policy, 'Read', { file_path: device })).toMatchObject({ behavior: 'deny' });
    }
  });

  it('末尾の「.」や空白で秘密の名前を言い換えても読めない', async () => {
    await fixture(join(outside, 'server.pem'));
    expect(await read(join(outside, 'server.pem.'))).toMatchObject({ behavior: 'deny' });
    expect(await read(join(outside, 'server.pem '))).toMatchObject({ behavior: 'deny' });
  });
});
