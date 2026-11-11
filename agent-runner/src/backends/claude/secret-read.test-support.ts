import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CanUseTool } from '@anthropic-ai/claude-agent-sdk';
import { afterAll, beforeAll, vi } from 'vitest';
import cases from '../../../../contracts/behavior/role-permissions.json' with { type: 'json' };
import type { RunRequest } from '../types.ts';
import { fileAccessPolicy } from './permissions.ts';

export let root: string;
export let home: string;
export let workspace: string;
export let peer: string;
export let outside: string;
export const secrets = [
  '.ssh/config',
  '.gnupg/secret',
  '.aws/credentials',
  '.azure/token',
  '.kube/config',
  '.docker/config.json',
  '.config/gcloud/application_default_credentials.json',
  '.config/gh/hosts.yml',
  '.netrc',
  '.npmrc',
  '.pypirc',
  '.git-credentials',
  '.codex/auth.json',
  '.codex/config.toml',
  '.claude/.credentials.json',
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.claude.json',
  'Library/Keychains/login.keychain-db',
  'Library/Cookies/Cookies.binarycookies',
  'Library/Mail/message',
  'Library/Messages/chat.db',
  'Library/Safari/history.db',
  'Library/Accounts/Accounts4.sqlite',
  'Library/Containers/com.apple.Safari/Data/test',
  'Library/Group Containers/group.com.apple.mail/message',
  'Library/Application Support/Google/Chrome/Default/Login Data',
  'Library/Application Support/Chromium/Default/Cookies',
  'Library/Application Support/Firefox/profiles/test',
  'Library/Application Support/Microsoft Edge/Default/Cookies',
  'Library/Application Support/BraveSoftware/test',
  'Library/Application Support/Arc/test',
  'Library/Application Support/com.operasoftware.Opera/Default/Login Data',
  'Library/Application Support/com.agentguild.app/settings.json',
  'Library/Application Support/com.agentguild.app/settings.json.tmp',
  'Library/WebKit/com.agentguild.app/WebsiteData/test',
];
export const names = [
  '.env',
  '.env.local',
  '.env.production',
  'private.pem',
  'private.key',
  'private.p12',
  'private.pfx',
  'id_rsa',
  'id_rsa.pub',
  'id_ed25519_backup',
  'id_ecdsa',
  'id_dsa',
  'guild.db',
  'guild.db-wal',
  'guild.db-shm',
  'guild.db.bak-20261111',
  'guild.db.tmp',
];
export async function fixture(path: string, text = 'fixture-secret'): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}
beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'guild-secret-read-')));
  home = join(root, 'home');
  workspace = join(root, 'work');
  peer = join(root, 'peer');
  outside = join(root, 'public');
  for (const dir of [home, workspace, peer, outside]) await mkdir(dir);
  for (const name of secrets) await fixture(join(home, name));
  for (const name of names) await fixture(join(root, 'named', name));
  await fixture(join(outside, 'README.md'), 'public text');
  await fixture(join(outside, 'nested/source.ts'), 'public source');
  await fixture(join(workspace, '.env'));
  await fixture(join(peer, '.env'));
  await symlink(join(home, '.ssh'), join(workspace, 'secret-link'), 'dir');
  await symlink(join(home, '.ssh/config'), join(root, 'alias'));
  await symlink(join(home, '.ssh/missing'), join(root, 'dangling'));
  await symlink(join(root, 'loop'), join(root, 'loop'));
  vi.stubEnv('CODEX_HOME', join(root, 'custom-codex'));
  vi.stubEnv('CLAUDE_CONFIG_DIR', join(root, 'custom-claude'));
  await fixture(join(root, 'custom-codex/auth.json'));
  await fixture(join(root, 'custom-claude/.credentials.json'));
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});
export function request(role = '専門家'): RunRequest {
  return {
    type: 'run',
    id: 'secret-test',
    backend: 'claude',
    workspace,
    stateDir: join(root, 'state'),
    readableDirs: [peer],
    permissions: cases.find((row) => row.name === `${role} / claude`)!.permissions,
    systemPrompt: '',
    prompt: '',
    intent: '',
    model: '',
    options: {},
    skills: [],
    images: [],
  };
}
export const call = (policy: CanUseTool, tool: string, input: Record<string, unknown>) =>
  policy(tool, input, { signal: new AbortController().signal, toolUseID: 'secret-test' } as Parameters<CanUseTool>[2]);
export const read = (path: string, role = '専門家') =>
  call(fileAccessPolicy(request(role)), 'Read', { file_path: path });
