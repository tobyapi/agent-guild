import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { setImmediate } from 'node:timers/promises';
import { expect, it, vi } from 'vitest';
import { Dispatcher } from '../../dispatcher.ts';
import type { RunnerEvent } from '../../protocol.ts';
import { claudeAdapter } from '../claude.ts';
import { BackendRegistry } from '../registry.ts';
import { runRequest } from '../run.test-support.ts';

const mocked = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@anthropic-ai/claude-agent-sdk', async (original) => ({
  ...(await original<object>()),
  query: mocked.query,
}));
vi.mock('../command-sandbox.ts', async (original) => ({
  ...(await original<object>()),
  prepareCommandSandbox: () => Promise.resolve(false),
}));
vi.mock('./executable.ts', async (original) => ({
  ...(await original<object>()),
  findClaude: () => 'claude',
}));
vi.mock('../auth-mode.ts', async (original) => ({
  ...(await original<object>()),
  claudeAuthEnvironment: () => Promise.resolve({}),
}));

it('上限が空欄なら31往復目にも進み、停止要求が実行中の SDK に届く', async () => {
  let sdkOptions: Options | undefined;
  let toolCalls = 0;
  mocked.query.mockImplementation(async function* ({ options }: { options: Options }) {
    sdkOptions = options;
    for (let i = 0; i < 31; i++) {
      await setImmediate();
      yield { type: 'assistant', message: { model: 'm', content: [{ type: 'tool_use', name: 'Read', input: {} }] } };
      options.abortController!.signal.throwIfAborted();
    }
    yield { type: 'result', subtype: 'success', is_error: false, result: '完了' };
  });

  const request = runRequest('claude');
  request.permissions = { ...request.permissions, runCommands: false, skills: false };
  const terminal = await new Promise<RunnerEvent>((resolve) => {
    const dispatcher = new Dispatcher({
      registry: new BackendRegistry([claudeAdapter]),
      runnerVersion: 'test',
      exit: vi.fn(),
      send(event) {
        if (event.type === 'activity' && ++toolCalls === 31) {
          dispatcher.receive({ kind: 'message', value: { type: 'cancel', id: request.id } });
        }
        if (event.type === 'result' || event.type === 'error') resolve(event);
      },
    });
    dispatcher.receive({ kind: 'message', value: request });
  });

  expect(toolCalls).toBe(31);
  expect(sdkOptions).toBeDefined();
  expect(sdkOptions).not.toHaveProperty('maxTurns');
  expect(sdkOptions?.abortController?.signal.aborted).toBe(true);
  expect(terminal).toMatchObject({ id: request.id, type: 'error', code: 'cancelled' });
});
