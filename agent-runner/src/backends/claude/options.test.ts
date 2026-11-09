import { describe, expect, it } from 'vitest';
import type { Permissions } from '../../protocol.ts';
import type { RunRequest } from '../types.ts';
import { claudeOptions, toolsFor } from './options.ts';

const WORKER: Permissions = { webSearch: true, webFetch: true, readFiles: true, writeFiles: true, writeAnywhere: false, runCommands: false, skills: true };
const EXPERT: Permissions = { ...WORKER, writeFiles: false };

const request = (permissions: Permissions, options: Record<string, unknown> = {}, model = ''): RunRequest => ({
  type: 'run', id: 'j1', backend: 'claude', workspace: '/data/a1/work', stateDir: '/data/a1/state/claude',
  readableDirs: ['/data/a0/work'], systemPrompt: 'あなたはハルです', prompt: 'こんにちは', model, permissions,
  skills: [], images: [], options,
});

describe('toolsFor', () => {
  it('権限ごとに使えるツールを決める（専門家は書き込みなし、コマンドは runCommands のときだけ）', () => {
    expect(toolsFor(WORKER)).toEqual(['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep', 'Write', 'Edit', 'Skill']);
    expect(toolsFor(EXPERT)).toEqual(['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep', 'Skill']);
    expect(toolsFor({ ...WORKER, runCommands: true })).toContain('Bash');
  });
});

describe('claudeOptions', () => {
  it('作業場所の設定は読ませず、スキルはプラグインで渡し、ファイル操作は canUseTool に任せる', () => {
    const options = claudeOptions(request(WORKER), new AbortController(), '/data/a1/state/claude/guild-skills');
    expect(options).toMatchObject({
      cwd: '/data/a1/work',
      additionalDirectories: ['/data/a0/work'],
      model: 'sonnet',
      systemPrompt: 'あなたはハルです',
      settingSources: [],
      plugins: [{ type: 'local', path: '/data/a1/state/claude/guild-skills' }],
      skills: 'all',
      permissionMode: 'default',
      persistSession: false,
      maxTurns: 30,
    });
    expect(options.allowedTools).toEqual(['WebSearch', 'WebFetch']);
    expect(options.canUseTool).toBeTypeOf('function');
  });

  it('スキル権限がなければプラグインも skills も渡さない', () => {
    const options = claudeOptions(request({ ...EXPERT, skills: false }, {}, 'opus'), new AbortController(), null);
    expect(options).not.toHaveProperty('skills');
    expect(options.plugins).toEqual([]);
    expect(options.model).toBe('opus');
  });

  it('読み取り権限がなければ readableDirs を渡さない', () => {
    const options = claudeOptions(request({ ...EXPERT, readFiles: false }), new AbortController(), null);
    expect(options.additionalDirectories).toEqual([]);
  });

  it('options は maxTurns（正の整数）だけ使う', () => {
    expect(claudeOptions(request(WORKER, { maxTurns: 5 }), new AbortController(), null).maxTurns).toBe(5);
    expect(claudeOptions(request(WORKER, { maxTurns: -1, effort: 'max' }), new AbortController(), null)).toMatchObject({
      maxTurns: 30,
    });
  });
});
