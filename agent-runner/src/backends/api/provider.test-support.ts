import { vi } from 'vitest';
import { deepseekAdapter } from '../deepseek.ts';
import { geminiAdapter } from '../gemini.ts';
import type { Item } from './json.ts';

export const providers = [
  { id: 'deepseek', envVar: 'DEEPSEEK_API_KEY', adapter: deepseekAdapter },
  { id: 'gemini', envVar: 'GEMINI_API_KEY', adapter: geminiAdapter },
] as const;
export function events(values: Array<Item | string>): Response {
  return new Response(
    values.map((value) => `data: ${typeof value === 'string' ? value : JSON.stringify(value)}\n\n`).join(''),
    {
      headers: { 'Content-Type': 'text/event-stream' },
    },
  );
}
export function textEvents(id: string, text = 'hello back'): Array<Item | string> {
  return id === 'deepseek'
    ? [
        {
          choices: [
            { index: 0, delta: { content: text, reasoning_content: 'private-thought' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 2, completion_tokens: 3 },
        },
        '[DONE]',
      ]
    : [
        {
          candidates: [
            {
              index: 0,
              content: { role: 'model', parts: [{ thought: true, text: 'private-thought' }, { text }] },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, thoughtsTokenCount: 2 },
        },
      ];
}
export function callEvents(
  id: string,
  calls = [{ id: 'call-1', name: 'post', args: '{"text":"progress"}' }],
): Array<Item | string> {
  return id === 'deepseek'
    ? [
        {
          choices: [
            {
              index: 0,
              delta: {
                reasoning_content: 'private-thought',
                tool_calls: calls.map((call, index) => ({
                  index,
                  id: call.id,
                  type: 'function',
                  function: { name: call.name, arguments: call.args },
                })),
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
        '[DONE]',
      ]
    : [
        {
          candidates: [
            {
              index: 0,
              content: {
                role: 'model',
                parts: calls.map((call, index) => ({
                  functionCall: { id: call.id, name: call.name, args: JSON.parse(call.args) as unknown },
                  ...(index === 0 ? { thoughtSignature: 'opaque-signature' } : {}),
                })),
              },
              finishReason: 'STOP',
            },
          ],
        },
      ];
}
export function mockFetch(id: string) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(events(textEvents(id))));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
export function requestBody(fetcher: ReturnType<typeof mockFetch>, index = 0): Item {
  const body = fetcher.mock.calls[index]![1]!.body;
  if (typeof body !== 'string') throw new Error('Expected a JSON request body');
  return JSON.parse(body) as Item;
}
