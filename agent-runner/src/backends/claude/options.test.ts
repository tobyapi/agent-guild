import { describe, expect, it, vi } from 'vitest';
import type { Permissions } from '../../protocol.ts';
import type { RunRequest } from '../types.ts';
import { claudeOptions, toolsFor, type ClaudeRun } from './options.ts';
import { POST_TOOL } from './post.ts';

const WORKER: Permissions = { webSearch: true, webFetch: true, readFiles: true, writeFiles: true, writeAnywhere: false, runCommands: false, skills: true };
const EXPERT: Permissions = { ...WORKER, writeFiles: false };

const request = (permissions: Permissions, options: Record<string, unknown> = {}, model = ''): RunRequest => ({
  type: 'run', id: 'j1', backend: 'claude', workspace: '/data/a1/work', stateDir: '/data/a1/state/claude',
  readableDirs: ['/data/a0/work'], systemPrompt: 'あなたはハルです', prompt: 'こんにちは', model, permissions,
  skills: [], images: [], options,
});

const run = (pluginDir: string | null = null): ClaudeRun => ({
  abortController: new AbortController(),
  pluginDir,
  onPost: vi.fn(),
  executable: 'C:\\Users\\me\\.local\\bin\\claude.exe',
});

describe('toolsFor', () => {
  it('権限ごとに使えるツールを決める（専門家は書き込みなし、コマンドは runCommands のときだけ）', () => {
    expect(toolsFor(WORKER)).toEqual(['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep', 'Write', 'Edit', 'Skill']);
    expect(toolsFor(EXPERT)).toEqual(['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep', 'Skill', 'Write', 'Edit']);
    expect(toolsFor({ ...EXPERT, readFiles: false, skills: false }), 'MEMORY.md のための読み書き').toEqual([
      'WebSearch',
      'WebFetch',
      'Read',
      'Write',
      'Edit',
    ]);
    expect(toolsFor({ ...WORKER, runCommands: true })).toContain('Bash');
  });
});

describe('claudeOptions', () => {
  it('作業場所の設定は読ませず、スキルはプラグインで渡し、ファイル操作は canUseTool に任せ、途中の投稿ツールは確認なしで許す', () => {
    const options = claudeOptions(request(WORKER), run('/data/a1/state/claude/guild-skills'));
    expect(options).toMatchObject({
      pathToClaudeCodeExecutable: 'C:\\Users\\me\\.local\\bin\\claude.exe',
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
    expect(options.allowedTools).toEqual(['WebSearch', 'WebFetch', POST_TOOL]);
    expect(options.mcpServers?.guild).toMatchObject({ type: 'sdk', name: 'guild' });
    expect(options.canUseTool).toBeTypeOf('function');
  });

  it('スキル権限がなければプラグインも skills も渡さない', () => {
    const options = claudeOptions(request({ ...EXPERT, skills: false }, {}, 'opus'), run());
    expect(options).not.toHaveProperty('skills');
    expect(options.plugins).toEqual([]);
    expect(options.model).toBe('opus');
  });

  it('読み取り権限がなければ readableDirs を渡さない', () => {
    const options = claudeOptions(request({ ...EXPERT, readFiles: false }), run());
    expect(options.additionalDirectories).toEqual([]);
  });

  it('options は maxTurns（正の整数）と effort（Claude Code の深さ）を使う', () => {
    expect(claudeOptions(request(WORKER, { maxTurns: 5 }), run()).maxTurns).toBe(5);
    expect(claudeOptions(request(WORKER, { maxTurns: -1, effort: 'max' }), run())).toMatchObject({
      maxTurns: 30,
      effort: 'max',
    });
    expect(claudeOptions(request(WORKER, { effort: 'ultra' }), run()).effort, '知らない深さは渡さない').toBeUndefined();
    expect(claudeOptions(request(WORKER), run()).effort, '選ばなければ Claude Code の既定').toBeUndefined();
  });
});
