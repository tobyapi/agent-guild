import { mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Permissions } from '../../protocol.ts';
import type { RunRequest } from '../types.ts';
import { fileAccessPolicy } from './permissions.ts';
import { unenforceableReason } from './rules.ts';

const ROOT = realpathSync(mkdtempSync(join(tmpdir(), 'guild-policy-')));
const WORK = join(ROOT, 'a1', 'work');
const PEER = join(ROOT, 'a0', 'work');
mkdirSync(WORK, { recursive: true });
mkdirSync(PEER, { recursive: true });
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));
const WORKER: Permissions = {
  webSearch: true,
  webFetch: true,
  readFiles: true,
  readAnywhere: false,
  writeFiles: true,
  writeAnywhere: false,
  runCommands: false,
  skills: true,
};
const EXPERT: Permissions = { ...WORKER, writeFiles: false };

const request = (permissions: Permissions): RunRequest => ({
  type: 'run',
  id: 'j1',
  backend: 'claude',
  workspace: WORK,
  stateDir: join(ROOT, 'a1', 'state', 'claude'),
  readableDirs: [PEER],
  systemPrompt: '',
  prompt: '',
  intent: '',
  model: '',
  permissions,
  skills: [],
  images: [],
  options: {},
});

async function decide(permissions: Permissions, toolName: string, input: Record<string, unknown>): Promise<string> {
  const context = { signal: new AbortController().signal, toolUseID: 'tool-1', requestId: 'request-1' };
  const result = await fileAccessPolicy(request(permissions))(toolName, input, context);
  return result?.behavior ?? 'none';
}

describe('fileAccessPolicy', () => {
  it('書き込みは作業場所の中だけ（相対パスは作業場所から）', async () => {
    expect(await decide(WORKER, 'Write', { file_path: join(WORK, 'report.md') })).toBe('allow');
    expect(await decide(WORKER, 'Edit', { file_path: 'notes/todo.md' })).toBe('allow');
    expect(await decide(WORKER, 'Write', { file_path: join(PEER, 'x.md') })).toBe('deny');
    expect(await decide(WORKER, 'Edit', { file_path: join(ROOT, 'a1', 'state', 'claude', 'x') })).toBe('deny');
    expect(await decide(WORKER, 'Write', { file_path: '../../a0/work/x.md' })).toBe('deny');
  });

  it('書き込み権限がなければ作業場所の中でも拒否する', async () => {
    expect(await decide(EXPERT, 'Write', { file_path: join(WORK, 'report.md') })).toBe('deny');
  });

  it('作業場所の MEMORY.md だけは、読み書きの権限がなくても読み書きできる', async () => {
    const none = { ...EXPERT, readFiles: false };
    expect(await decide(none, 'Edit', { file_path: join(WORK, 'MEMORY.md') })).toBe('allow');
    expect(await decide(none, 'Write', { file_path: 'MEMORY.md' })).toBe('allow');
    expect(await decide(none, 'Read', { file_path: join(WORK, 'MEMORY.md') })).toBe('allow');
    expect(await decide(none, 'Write', { file_path: join(WORK, 'MEMORY.md', 'x.md') })).toBe('deny');
    expect(await decide(none, 'Write', { file_path: join(PEER, 'MEMORY.md') })).toBe('deny');
    expect(await decide(none, 'Read', { file_path: join(WORK, 'notes.md') })).toBe('deny');
  });

  it('読み取りは作業場所と readableDirs だけ', async () => {
    expect(await decide(EXPERT, 'Read', { file_path: join(PEER, 'draft.md') })).toBe('allow');
    expect(await decide(EXPERT, 'Grep', { pattern: 'TODO' })).toBe('allow');
    expect(await decide(EXPERT, 'Glob', { pattern: '*', path: join(ROOT, 'a2', 'work') })).toBe('deny');
    expect(await decide({ ...EXPERT, readFiles: false }, 'Read', { file_path: join(WORK, 'a.md') })).toBe('deny');
  });

  it('道具がホームに読み替える「~」や前後の空白つきのパスは、作業場所の中に見えても拒否する', async () => {
    expect(await decide(EXPERT, 'Grep', { pattern: 'PRIVATE KEY', path: '~/.ssh' })).toBe('deny');
    expect(await decide(EXPERT, 'Glob', { pattern: '*', path: '~' })).toBe('deny');
    expect(await decide(EXPERT, 'LS', { path: ' /etc' })).toBe('deny');
    expect(await decide(EXPERT, 'Read', { file_path: '~/.aws/credentials' })).toBe('deny');
    expect(await decide({ ...EXPERT, readAnywhere: true }, 'Grep', { pattern: 'KEY', path: '~/.ssh' })).toBe('deny');
    expect(await decide({ ...WORKER, writeAnywhere: true }, 'Grep', { pattern: 'x', path: '~/projects' })).toBe(
      'allow',
    );
  });

  it('writeAnywhere なら、作業場所の外でも読み書きできる（読み取りの権限がなければ読めない）', async () => {
    const anywhere = { ...WORKER, writeAnywhere: true };
    const elsewhere = resolve('/projects/app/README.md');
    expect(await decide(anywhere, 'Write', { file_path: elsewhere })).toBe('allow');
    expect(await decide(anywhere, 'Edit', { file_path: join(PEER, 'x.md') })).toBe('allow');
    expect(await decide(anywhere, 'Read', { file_path: elsewhere })).toBe('allow');
    expect(await decide(anywhere, 'Grep', { pattern: 'TODO', path: resolve('/projects') })).toBe('allow');
    expect(await decide({ ...anywhere, readFiles: false }, 'Read', { file_path: elsewhere })).toBe('deny');
    expect(await decide(anywhere, 'Bash', { command: 'ls' })).toBe('deny');
  });

  it('ファイル以外のツールは canUseTool では許さない', async () => {
    expect(await decide(WORKER, 'Bash', { command: 'rm -rf /' })).toBe('deny');
  });
});

describe('unenforceableReason', () => {
  it('コマンドの実行は、ファイル（作業場所の外も）とネットワークをすべて許すときだけ守れる', () => {
    const all = { ...WORKER, writeAnywhere: true, runCommands: true };
    expect(unenforceableReason(WORKER)).toBeNull();
    expect(unenforceableReason(all)).toBeNull();
    expect(unenforceableReason({ ...WORKER, runCommands: true })).toContain('コマンド');
    expect(unenforceableReason({ ...all, webFetch: false })).toContain('コマンド');
    expect(unenforceableReason(EXPERT)).toBeNull();
  });

  it('作業場所の外への書き込みは、書き込みを許すときだけ', () => {
    expect(unenforceableReason({ ...WORKER, writeAnywhere: true })).toBeNull();
    expect(unenforceableReason({ ...EXPERT, writeAnywhere: true })).toContain('書き込み');
  });
});
