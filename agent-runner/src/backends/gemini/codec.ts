import { invalid, type Item } from '../api/json.ts';
import type { Codec, Turn } from '../api/codec.ts';
import { usage } from '../api/usage.ts';
import { State } from './parts.ts';

async function receive(events: AsyncIterable<Item | null>, model: string): Promise<Turn> {
  const state = new State();
  for await (const event of events) {
    if (event === null) throw invalid();
    state.add(event);
  }
  if (!state.finished) throw invalid();
  return {
    text: state.text,
    calls: state.calls,
    continuation: { role: 'model', parts: state.parts },
    usage: usage(state.rawUsage, model, 'promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount'),
  };
}
export const geminiCodec: Codec = {
  endpoint: (model) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
  headers: (key) => ({ 'x-goog-api-key': key }),
  initial: (request, system) => [
    { role: 'system', parts: [{ text: system }] },
    { role: 'user', parts: [{ text: request.prompt }] },
  ],
  body: (_model, effort, history, definitions) => ({
    systemInstruction: { parts: history[0]!.parts },
    contents: history.slice(1),
    generationConfig: {
      candidateCount: 1,
      maxOutputTokens: 16384,
      thinkingConfig: { thinkingLevel: effort.toUpperCase(), includeThoughts: false },
    },
    tools: [
      {
        functionDeclarations: definitions.map(({ name, description, parameters }) => ({
          name,
          description,
          parametersJsonSchema: parameters,
        })),
      },
    ],
  }),
  receive,
  results: (calls, outputs) => [
    {
      role: 'user',
      parts: calls.map((call, index) => ({
        functionResponse: {
          // IDs are optional on older GenerateContent responses; only send IDs the server supplied.
          ...(call.wireId !== undefined ? { id: call.wireId } : {}),
          name: call.name,
          response: { result: outputs[index]! },
        },
      })),
    },
  ],
};
