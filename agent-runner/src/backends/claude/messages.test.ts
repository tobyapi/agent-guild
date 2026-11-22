import { Readable } from 'node:stream';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it, vi } from 'vitest';
import { BackendError } from '../types.ts';
import { consumeMessages } from './messages.ts';
import { t } from './texts/index.ts';

const assistant = (...paragraphs: string[]): SDKMessage =>
  ({
    type: 'assistant',
    parent_tool_use_id: null,
    message: { model: 'claude-sonnet', content: paragraphs.map((text) => ({ type: 'text', text })) },
  }) as unknown as SDKMessage;

const result = (fields: Record<string, unknown>): SDKMessage =>
  ({
    type: 'result',
    is_error: true,
    num_turns: 31,
    modelUsage: {},
    total_cost_usd: 0,
    errors: [],
    ...fields,
  }) as unknown as SDKMessage;

const consume = (messages: SDKMessage[], maxTurns?: number) =>
  consumeMessages(Readable.from(messages), vi.fn(), vi.fn(), maxTurns);

describe('consumeMessages', () => {
  it('成功なら result の文章を返す', async () => {
    await expect(
      consume([assistant('途中'), result({ subtype: 'success', is_error: false, result: '完了' })]),
    ).resolves.toBe('完了');
    await expect(
      consume([assistant('先頭', '末尾'), result({ subtype: 'success', is_error: false, result: '' })]),
    ).resolves.toBe('末尾');
  });

  it('ターン数の上限で止まったら、失敗にせず、最後の文章に止まったことの一文を付けて返す', async () => {
    const note = t('maxTurnsReached', { maxTurns: '5' });
    expect(note).toContain('5');
    await expect(
      consume(
        [assistant('着手'), assistant('調査結果', '次は検証'), assistant('  '), result({ subtype: 'error_max_turns' })],
        5,
      ),
    ).resolves.toBe(`調査結果\n\n次は検証\n\n${note}`);
  });

  it('上限で止まり、まだ文章がなければ注記だけを返す（上限が渡されなければ num_turns を使う）', async () => {
    await expect(consume([result({ subtype: 'error_max_turns', num_turns: 7 })])).resolves.toBe(
      t('maxTurnsReached', { maxTurns: '7' }),
    );
  });

  it('ほかの失敗は今までどおり BackendError にする', async () => {
    const run = consume([assistant('途中'), result({ subtype: 'error_during_execution', errors: ['boom'] })], 5);
    await expect(run).rejects.toBeInstanceOf(BackendError);
    await expect(run).rejects.toThrow(t('interrupted', { detail: 'boom' }));
  });
});
