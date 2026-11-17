import { expect, it } from 'vitest';
import { deepseekCodec } from './codec.ts';
import type { Item } from '../api/json.ts';

async function* sequence(values: Array<Item | null>) {
  yield* await Promise.resolve(values);
}
it('assembles tool names, JSON arguments, text and reasoning from separate deltas', async () => {
  const result = await deepseekCodec.receive(
    sequence([
      {
        choices: [
          {
            index: 0,
            delta: {
              reasoning_content: 'private-',
              content: 'one',
              tool_calls: [{ index: 0, id: 'a', type: 'function', function: { name: 'po', arguments: '{"te' } }],
            },
          },
        ],
      },
      {
        choices: [
          {
            index: 0,
            delta: {
              reasoning_content: 'reason',
              content: 'two',
              tool_calls: [{ index: 0, function: { name: 'st', arguments: 'xt":"ok"}' } }],
            },
            finish_reason: 'tool_calls',
          },
        ],
      },
      null,
    ]),
    'deepseek-flash',
  );
  expect(result.text).toBe('onetwo');
  expect(result.calls).toEqual([{ id: 'a', name: 'post', args: '{"text":"ok"}' }]);
  expect(result.continuation.reasoning_content).toBe('private-reason');
});
it('rejects invalid call indexes, sparse calls and incompatible finish reasons', async () => {
  for (const index of [-1, 20, 0.5, 1]) {
    await expect(
      deepseekCodec.receive(
        sequence([
          {
            choices: [
              {
                index: 0,
                delta: { tool_calls: [{ index, id: 'a', function: { name: 'post', arguments: '{}' } }] },
                finish_reason: 'tool_calls',
              },
            ],
          },
          null,
        ]),
        'deepseek-flash',
      ),
    ).rejects.toThrow();
  }
});
