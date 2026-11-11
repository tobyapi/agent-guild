import { describe, expect, it, vi } from 'vitest';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import type { RunRequest } from '../types.ts';
import { claudeJudge } from './judge.ts';

const mocked = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@anthropic-ai/claude-agent-sdk', async (original) => ({
  ...(await original<object>()),
  query: mocked.query,
}));

describe('判定用モデルの連携抑止', () => {
  it('query を差し替え、道具なし・strict MCP・連携無効・全拒否フックを渡すことを確認する', async () => {
    mocked.query.mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'result', subtype: 'success', result: 'ALLOW', usage: {}, modelUsage: {} };
    });
    const judge = claudeJudge(
      { workspace: '/synthetic', intent: '' } as RunRequest,
      'unused',
      new AbortController().signal,
      vi.fn(),
    );
    expect(await judge({ label: 'synthetic', detail: '' })).toEqual({ allow: true, reason: '' });
    const { options } = mocked.query.mock.calls[0]![0] as { options: Options };
    expect(options).toMatchObject({ tools: [], strictMcpConfig: true, env: { ENABLE_CLAUDEAI_MCP_SERVERS: 'false' } });
    const hook = options.hooks!.PreToolUse![0]!.hooks[0]!;
    expect(
      await hook(
        { hook_event_name: 'PreToolUse', tool_name: 'mcp__claude_ai_Gmail__send_message', tool_input: {} } as never,
        'synthetic',
        { signal: new AbortController().signal },
      ),
    ).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
  });
});
