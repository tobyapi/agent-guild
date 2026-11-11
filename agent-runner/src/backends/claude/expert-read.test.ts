import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import cases from '../../../../contracts/behavior/role-permissions.json' with { type: 'json' };
import type { RunRequest } from '../types.ts';
import { fileAccessPolicy } from './permissions.ts';
import { claudeOptions, toolsFor } from './options.ts';
import { threadOptions, codexConfig } from '../codex-runtime/options.ts';

let root: string;
let workspace: string;
let outside: string;
beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'guild-expert-read-')));
  workspace = join(root, 'work');
  outside = join(root, 'outside');
  await mkdir(workspace);
  await mkdir(outside);
  await writeFile(join(outside, 'source.txt'), 'review source');
  await symlink(outside, join(workspace, 'link'), 'dir');
  await symlink(join(outside, 'missing.txt'), join(workspace, 'dangling'));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});
function request(role: string, backend = 'claude'): RunRequest {
  const permissions = cases.find((example) => example.name === `${role} / ${backend}`)!.usable;
  return {
    type: 'run',
    id: 'read-test',
    backend,
    permissions,
    workspace,
    stateDir: join(root, 'state'),
    readableDirs: [],
    systemPrompt: '',
    prompt: '',
    intent: '',
    model: '',
    options: {},
    skills: [],
    images: [],
  };
}
async function decision(role: string, tool: string, path: string) {
  return fileAccessPolicy(request(role))(
    tool,
    { file_path: path },
    {
      signal: new AbortController().signal,
      toolUseID: 't1',
      requestId: 'r1',
    },
  );
}
describe.each(['専門家', 'マネージャー'])('%s の独立した読み取り範囲', (role) => {
  it('相談元以外のファイルを読めて、作業場所内に結果を作れる', async () => {
    expect(await decision(role, 'Read', join(outside, 'source.txt'))).toMatchObject({ behavior: 'allow' });
    expect(await readFile(join(outside, 'source.txt'), 'utf8')).toBe('review source');
    expect(await decision(role, 'Write', join(workspace, 'review.txt'))).toMatchObject({ behavior: 'allow' });
  });
  it('外への作成・編集・シンボリックリンク経由の書き込みができない', async () => {
    for (const tool of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']) {
      for (const path of [
        join(outside, 'source.txt'),
        join(outside, 'new.txt'),
        join(workspace, 'link', 'source.txt'),
        join(workspace, 'link', 'new.txt'),
        join(workspace, 'dangling'),
      ]) {
        expect(await decision(role, tool, path), `${tool}: ${path}`).toMatchObject({ behavior: 'deny' });
      }
    }
    expect(await readFile(join(outside, 'source.txt'), 'utf8')).toBe('review source');
  });
  it('作業者の外への読み書きと発想役の範囲制限は維持する', async () => {
    for (const tool of ['Read', 'Write']) {
      expect(await decision('作業者', tool, join(outside, 'source.txt'))).toMatchObject({ behavior: 'allow' });
      for (const role of ['発想役']) {
        expect(await decision(role, tool, join(outside, 'source.txt'))).toMatchObject({ behavior: 'deny' });
      }
    }
  });
  it('Claude の書き込み許可ディレクトリを広げず、コマンドと Web の道具を増やさない', () => {
    const req = request(role);
    const options = claudeOptions(req, {
      abortController: new AbortController(),
      pluginDir: null,
      onPost: () => {},
      onUsage: () => {},
      executable: 'claude',
    });
    expect(options.additionalDirectories).toEqual([]);
    expect(toolsFor(req.permissions)).not.toContain('Bash');
    expect(toolsFor(req.permissions)).not.toContain('WebFetch');
    expect(toolsFor(req.permissions)).not.toContain('WebSearch');
  });
  it('Codex は workspace-write と一時フォルダ除外を維持し、外への書き込み先を追加しない', () => {
    const req = request(role, 'codex');
    const options = threadOptions(req);
    expect(options).toMatchObject({
      sandboxMode: 'workspace-write',
      networkAccessEnabled: false,
      webSearchMode: 'disabled',
      approvalPolicy: 'never',
    });
    expect(options.additionalDirectories).toBeUndefined();
    expect(codexConfig(req).sandbox_workspace_write).toEqual({ exclude_tmpdir_env_var: true, exclude_slash_tmp: true });
  });
});
