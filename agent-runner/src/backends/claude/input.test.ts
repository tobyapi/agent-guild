import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { claudePrompt, userMessage } from './input.ts';

let dir = '';
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'guild-claude-input-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('claudePrompt', () => {
  it('画像がなければ本文の文字列のまま渡す', async () => {
    expect(await claudePrompt('こんにちは', [])).toBe('こんにちは');
  });

  it('画像があれば、画像（base64・発言の順）→ 本文の1件のユーザーメッセージを流す', async () => {
    const path = join(dir, 'a.png');
    await writeFile(path, Buffer.from([1, 2, 3]));
    const prompt = await claudePrompt('見て', [{ path, mediaType: 'image/png' }]);
    if (typeof prompt === 'string') throw new Error('画像があるのに文字列で渡している');
    const messages: SDKUserMessage[] = [];
    for await (const message of prompt) messages.push(message);
    expect(messages).toEqual([
      {
        type: 'user',
        parent_tool_use_id: null,
        message: {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AQID' } },
            { type: 'text', text: '見て' },
          ],
        },
      },
    ]);
  });

  it('対応していない形式・読めない画像は bad_request で止める', async () => {
    await expect(userMessage('x', [{ path: join(dir, 'a.bmp'), mediaType: 'image/bmp' }])).rejects.toMatchObject({
      code: 'bad_request',
    });
    await expect(userMessage('x', [{ path: join(dir, 'missing.png'), mediaType: 'image/png' }])).rejects.toMatchObject({
      code: 'bad_request',
    });
  });
});
