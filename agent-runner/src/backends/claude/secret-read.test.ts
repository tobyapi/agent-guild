import { mkdir, readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fileAccessPolicy } from './permissions.ts';
import { checkedPolicy } from './check.ts';
import { claudeOptions } from './options.ts';
import {
  root,
  home,
  workspace,
  peer,
  outside,
  secrets,
  names,
  fixture,
  request,
  call,
  read,
} from './secret-read.test-support.ts';

vi.mock('node:os', async (original) => ({ ...(await original<typeof import('node:os')>()), homedir: () => home }));

describe('readAnywhere の秘密の場所の除外', () => {
  it.each(secrets)('%s の内容は読めない', async (name) => {
    expect(await read(join(home, name))).toMatchObject({ behavior: 'deny' });
  });
  it.each(names)('外部の名前 %s は読めず、配下の Grep も拒否する', async (name) => {
    const path = join(root, 'named', name);
    expect(await read(path)).toMatchObject({ behavior: 'deny' });
    expect(await call(fileAccessPolicy(request()), 'Grep', { path, pattern: 'fixture-secret' })).toMatchObject({
      behavior: 'deny',
    });
  });
  it.each(['専門家', 'マネージャー'])('%s と check.ts の経路も同じ判定を通る', async (role) => {
    const judge = vi.fn().mockResolvedValue({ allow: true, reason: '' });
    const req = request(role);
    const path = join(home, '.ssh/config');
    expect(await call(checkedPolicy(req, judge, vi.fn()), 'Read', { file_path: path })).toMatchObject({
      behavior: 'deny',
    });
    const plain = claudeOptions(
      { ...req, options: { operationCheck: false } },
      {
        abortController: new AbortController(),
        pluginDir: null,
        onPost: () => {},
        onUsage: () => {},
        executable: 'claude',
      },
    );
    expect(await call(plain.canUseTool!, 'Read', { file_path: path })).toMatchObject({ behavior: 'deny' });
    expect(judge).not.toHaveBeenCalled();
  });
  it('リンク・壊れたリンク・循環リンク経由では読めない', async () => {
    for (const path of [
      join(root, 'alias'),
      join(workspace, 'secret-link/config'),
      join(root, 'dangling'),
      join(root, 'loop'),
    ]) {
      expect(await read(path)).toMatchObject({ behavior: 'deny' });
    }
    await fixture(join(root, 'named/.env.directory/secret.txt'));
    expect(await read(join(root, 'named/.env.directory/secret.txt'))).toMatchObject({ behavior: 'deny' });
  });
  it.skipIf(process.platform !== 'darwin')('macOS の大文字違いでも拒否する', async () => {
    for (const path of [
      join(home, '.SSH/CONFIG'),
      join(home, 'LIBRARY/KEYCHAINS/login.keychain-db'),
      join(root, 'named/.ENV.LOCAL'),
    ]) {
      expect(await read(path)).toMatchObject({ behavior: 'deny' });
    }
  });
  it('認証ディレクトリの環境変数による移動も除外する', async () => {
    expect(await read(join(root, 'custom-codex/auth.json'))).toMatchObject({ behavior: 'deny' });
    expect(await read(join(root, 'custom-claude/.credentials.json'))).toMatchObject({ behavior: 'deny' });
  });
  it.each(['Grep', 'Glob', 'LS'])('%s は除外先の中と、それを含むホームを拒否する', async (tool) => {
    const policy = fileAccessPolicy(request());
    for (const path of [home, join(home, '.ssh'), join(home, 'Library'), join(home, '.codex')]) {
      expect(await call(policy, tool, { path, pattern: '*' })).toMatchObject({ behavior: 'deny' });
    }
  });
  it('Grep は隠れた .env のある外部フォルダを拒否し、中身はツールへ渡さない', async () => {
    const folder = join(root, 'project-with-secret');
    await fixture(join(folder, 'nested/.env.local'));
    const result = await call(fileAccessPolicy(request()), 'Grep', {
      path: folder,
      pattern: 'fixture-secret',
      output_mode: 'content',
    });
    expect(result).toMatchObject({ behavior: 'deny' });
    if (result?.behavior === 'deny') expect(result.message).toContain('除外対象の名前または場所');
    expect(JSON.stringify(result)).not.toContain('fixture-secret');
    expect(JSON.stringify(result)).not.toContain('.env.local');
  });
  it('外部検索の子リンクは安全な行き先でも拒否する', async () => {
    const folder = join(root, 'project-with-link');
    await mkdir(folder);
    await symlink(outside, join(folder, 'linked'), 'dir');
    const result = await call(fileAccessPolicy(request()), 'Grep', { path: folder, pattern: '.' });
    expect(result).toMatchObject({ behavior: 'deny' });
    if (result?.behavior === 'deny') expect(result.message).toMatch(/シンボリックリンク.*狭いフォルダ/);
  });
  it('検索の点検が深さの上限を超えたら拒否する', async () => {
    const folder = join(root, 'deep');
    await mkdir(join(folder, ...Array<string>(66).fill('d')), { recursive: true });
    const result = await call(fileAccessPolicy(request()), 'Grep', { path: folder, pattern: '.' });
    expect(result).toMatchObject({ behavior: 'deny' });
    if (result?.behavior === 'deny') expect(result.message).toContain('深さ64');
  });
  it('公開ファイルの Read と安全な外部フォルダの Grep・Glob を許す', async () => {
    expect(await read(join(outside, 'README.md'))).toMatchObject({ behavior: 'allow' });
    expect(await readFile(join(outside, 'README.md'), 'utf8')).toBe('public text');
    for (const tool of ['Grep', 'Glob']) {
      expect(await call(fileAccessPolicy(request()), tool, { path: outside, pattern: '**/*.ts' })).toMatchObject({
        behavior: 'allow',
      });
    }
    expect(
      await call(fileAccessPolicy(request()), 'Grep', { path: join(outside, 'README.md'), pattern: 'public' }),
    ).toMatchObject({ behavior: 'allow' });
  });
  it.each(['../*', '/etc/*', '{../*,*}', '**/../../*', '~/*', '..\\*'])(
    '外部 Glob の起点外を指せる pattern %s は拒否する',
    async (pattern) => {
      expect(await call(fileAccessPolicy(request()), 'Glob', { path: outside, pattern })).toMatchObject({
        behavior: 'deny',
      });
    },
  );
  it.each(['省略', '作業場所'])('Glob の path が%sでも絶対 pattern を拒否する', async (kind) => {
    const input = { pattern: join(home, '.ssh/*'), ...(kind === '作業場所' ? { path: workspace } : {}) };
    for (const role of ['専門家', 'マネージャー']) {
      const req = request(role);
      for (const policy of [fileAccessPolicy(req), checkedPolicy(req, vi.fn(), vi.fn())]) {
        const result = await call(policy, 'Glob', input);
        expect(result).toMatchObject({ behavior: 'deny' });
        if (result?.behavior === 'deny') expect(result.message).toContain('絶対パス pattern');
      }
    }
  });
  it('作業場所・readableDirs に元からある秘密名と検索は変えない', async () => {
    for (const dir of [workspace, peer]) {
      expect(await read(join(dir, '.env'))).toMatchObject({ behavior: 'allow' });
      for (const tool of ['Grep', 'Glob']) {
        expect(await call(fileAccessPolicy(request()), tool, { path: dir, pattern: '*' })).toMatchObject({
          behavior: 'allow',
        });
      }
    }
    expect(await call(fileAccessPolicy(request()), 'Write', { file_path: join(workspace, 'MEMORY.md') })).toMatchObject(
      { behavior: 'allow' },
    );
  });
  it('アプリデータの agents の作業場所は引き続き読める', async () => {
    const path = join(home, 'Library/Application Support/com.agentguild.app/data/agents/another/work/report.md');
    await fixture(path, 'report');
    expect(await read(path)).toMatchObject({ behavior: 'allow' });
  });
  it('書き込み・作業者・発想役の既存権限を変えない', async () => {
    const secret = join(home, '.ssh/config');
    for (const tool of ['Read', 'Write']) {
      expect(await call(fileAccessPolicy(request('作業者')), tool, { file_path: secret })).toMatchObject({
        behavior: 'allow',
      });
      expect(await call(fileAccessPolicy(request('発想役')), tool, { file_path: secret })).toMatchObject({
        behavior: 'deny',
      });
    }
    expect(await call(fileAccessPolicy(request()), 'Write', { file_path: secret })).toMatchObject({ behavior: 'deny' });
    expect(await call(fileAccessPolicy(request()), 'Write', { file_path: join(workspace, '.env') })).toMatchObject({
      behavior: 'allow',
    });
    expect(
      await call(fileAccessPolicy(request()), 'Edit', { file_path: join(workspace, 'secret-link/config') }),
    ).toMatchObject({ behavior: 'deny' });
  });
});
