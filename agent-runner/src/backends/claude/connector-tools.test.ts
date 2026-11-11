import { describe, expect, it, vi } from 'vitest';
import type { CanUseTool, HookCallback, PreToolUseHookInput } from '@anthropic-ai/claude-agent-sdk';
import cases from '../../../../contracts/behavior/role-permissions.json' with { type: 'json' };
import type { Permissions } from '../../protocol.ts';
import type { RunRequest } from '../types.ts';
import { checkedPolicy } from './check.ts';
import { fileAccessPolicy } from './permissions.ts';
import { claudeOptions } from './options.ts';
import { POST_TOOL } from './post.ts';
import { isolatedToolOptions, registeredToolsHook, toolsFor } from './tool-policy.ts';

const EXTERNAL = [
  'mcp__claude_ai_Gmail__send_message',
  'mcp__claude_ai_Slack__send_message',
  'mcp__claude_ai_Google_Drive__search',
  'mcp__guild__send_message',
  'mcp__guild__post_extra',
  'mcp__other__post',
  'ToolSearch',
  'constructor',
];
const context = { signal: new AbortController().signal, toolUseID: 'synthetic', requestId: 'synthetic' };
const request = (permissions: Permissions, options: Record<string, unknown> = {}): RunRequest => ({
  type: 'run',
  id: 'synthetic',
  backend: 'claude',
  workspace: '/synthetic/work',
  stateDir: '/synthetic/state',
  readableDirs: [],
  systemPrompt: '',
  prompt: '',
  intent: '',
  model: '',
  permissions,
  skills: [],
  images: [],
  options,
});
const call = (policy: CanUseTool, tool: string, input: Record<string, unknown> = {}) => policy(tool, input, context);
const hookCall = (hook: HookCallback, tool: string, source?: string) =>
  hook(
    {
      hook_event_name: 'PreToolUse',
      tool_name: tool,
      tool_input: {},
      tool_use_id: 'synthetic',
      ...(source ? { mcp_server: { source, name: 'guild' } } : {}),
    } as PreToolUseHookInput,
    'synthetic',
    { signal: context.signal },
  );

describe('登録されていない道具の拒否（実際の連携・SDK query は呼ばない）', () => {
  it.each(cases.filter((c) => c.backend === 'claude'))(
    '$name: 両入口で拒否し judge に渡さない',
    async ({ usable: permissions }) => {
      const judge = vi.fn().mockResolvedValue({ allow: true, reason: '' });
      const req = request(permissions);
      for (const policy of [fileAccessPolicy(req), checkedPolicy(req, judge, vi.fn())]) {
        for (const tool of EXTERNAL) expect(await call(policy, tool)).toMatchObject({ behavior: 'deny' });
        expect(await call(policy, 'Read', { file_path: '/synthetic/work/MEMORY.md' })).toMatchObject({
          behavior: 'allow',
        });
        expect(await call(policy, 'Glob', { pattern: '*.md' })).toMatchObject({ behavior: 'allow' });
        expect(await call(policy, POST_TOOL, { text: 'synthetic' })).toMatchObject({ behavior: 'allow' });
      }
      expect(judge).not.toHaveBeenCalled();
    },
  );

  it.each([{}, { operationCheck: true }, { operationCheck: false }])('全256権限組で拒否: %j', async (options) => {
    const keys: (keyof Permissions)[] = [
      'webSearch',
      'webFetch',
      'readFiles',
      'readAnywhere',
      'writeFiles',
      'writeAnywhere',
      'runCommands',
      'skills',
    ];
    for (let mask = 0; mask < 256; mask++) {
      const permissions = Object.fromEntries(
        keys.map((key, bit) => [key, Boolean(mask & (1 << bit))]),
      ) as unknown as Permissions;
      const sdk = claudeOptions(request(permissions, options), {
        abortController: new AbortController(),
        pluginDir: null,
        onPost: vi.fn(),
        onUsage: vi.fn(),
        executable: 'unused',
      });
      expect(sdk.strictMcpConfig).toBe(true);
      expect(sdk.env?.ENABLE_CLAUDEAI_MCP_SERVERS).toBe('false');
      for (const tool of EXTERNAL) expect(await call(sdk.canUseTool!, tool)).toMatchObject({ behavior: 'deny' });
      const hook = sdk.hooks!.PreToolUse![0]!.hooks[0]!;
      expect(await hookCall(hook, EXTERNAL[0]!)).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
      expect(await hookCall(hook, 'Read')).toEqual({});
      expect(await hookCall(hook, POST_TOOL, 'sdk')).toEqual({});
      expect(sdk.allowedTools).toContain(POST_TOOL);
    }
  });

  it('投稿と同じ名前でも SDK 以外・出自不明はフックで拒否する', async () => {
    const hook = registeredToolsHook([POST_TOOL]);
    for (const source of ['claudeai', 'user', 'plugin', 'dynamic', 'unknown', undefined]) {
      expect(await hookCall(hook, POST_TOOL, source)).toMatchObject({
        hookSpecificOutput: { permissionDecision: 'deny' },
      });
    }
    expect(await hookCall(hook, POST_TOOL, 'sdk')).toEqual({});
  });

  it('通常の道具はフックで先に許可せず、既存のパス判定へ進める。判定用モデルはすべて拒否する', async () => {
    const permissions = cases.find((c) => c.name === '作業者 / claude')!.usable;
    const tools = toolsFor(permissions);
    for (const tool of tools) expect(await hookCall(registeredToolsHook(tools), tool)).toEqual({});
    const judgeHook = isolatedToolOptions([]).hooks!.PreToolUse![0]!.hooks[0]!;
    for (const tool of [...tools, POST_TOOL, ...EXTERNAL]) {
      expect(await hookCall(judgeHook, tool, 'sdk')).toMatchObject({
        hookSpecificOutput: { permissionDecision: 'deny' },
      });
    }
  });
});
