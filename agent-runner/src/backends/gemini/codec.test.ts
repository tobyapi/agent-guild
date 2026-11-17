import { expect, it } from 'vitest';
import { geminiCodec } from './codec.ts';
import type { Item } from '../api/json.ts';

async function* sequence(values: Item[]) {
  yield* await Promise.resolve(values);
}
it('retains parts and signatures verbatim and omits invented IDs from optional-ID function results', async () => {
  const parts = [
    { thought: true, text: 'hidden' },
    { text: '' },
    { functionCall: { name: 'post', args: { text: 'ok' } }, thoughtSignature: 'opaque' },
    { text: '', thoughtSignature: 'tail' },
  ];
  const result = await geminiCodec.receive(
    sequence([
      { candidates: [{ index: 0, content: { role: 'model', parts: parts.slice(0, 2) } }] },
      { candidates: [{ index: 0, content: { role: 'model', parts: parts.slice(2) }, finishReason: 'STOP' }] },
    ]),
    'gemini-4-hydrogen',
  );
  expect(result.text).toBe('');
  expect(result.continuation).toEqual({ role: 'model', parts });
  expect(result.calls[0]!.id).toBeTruthy();
  expect(geminiCodec.results(result.calls, ['posted'])).toEqual([
    { role: 'user', parts: [{ functionResponse: { name: 'post', response: { result: 'posted' } } }] },
  ]);
});
it('refuses unsigned or invalid tool continuations and unsupported server tools', async () => {
  for (const part of [
    { functionCall: { name: 'post', args: { text: 'no signature' } } },
    { functionCall: { name: 'post', args: [] }, thoughtSignature: 'opaque' },
    { executableCode: { code: 'unknown' } },
  ]) {
    await expect(
      geminiCodec.receive(
        sequence([{ candidates: [{ content: { role: 'model', parts: [part] }, finishReason: 'STOP' }] }]),
        'gemini-4-hydrogen',
      ),
    ).rejects.toThrow();
  }
});
it('waits for a signature on a later part before accepting a completed tool batch', async () => {
  const parts = [
    { functionCall: { name: 'post', args: { text: 'ok' } } },
    { text: '', thoughtSignature: 'tail-signature' },
  ];
  const result = await geminiCodec.receive(
    sequence([
      { candidates: [{ content: { role: 'model', parts: parts.slice(0, 1) } }] },
      { candidates: [{ content: { role: 'model', parts: parts.slice(1) }, finishReason: 'STOP' }] },
    ]),
    'gemini-4-hydrogen',
  );
  expect(result.calls).toHaveLength(1);
  expect(result.continuation).toEqual({ role: 'model', parts });
});
