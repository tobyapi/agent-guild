import { blocked, invalid, object, truncated, type Item } from '../api/json.ts';
import type { Codec, Turn } from '../api/codec.ts';
import type { Call } from '../api/tools.ts';
import { usage } from '../api/usage.ts';
import { append, addCalls } from './deltas.ts';

class State {
  text = '';
  reasoning = '';
  finish = '';
  rawUsage: unknown;
  calls = new Map<number, Call>();
  add(event: Item): void {
    if (!Array.isArray(event.choices) || event.choices.length > 1) throw invalid();
    this.rawUsage = event.usage ?? this.rawUsage;
    for (const choice of event.choices) this.choice(choice);
  }
  choice(choice: unknown): void {
    if (!object(choice) || choice.index !== 0 || !object(choice.delta) || this.finish) throw invalid();
    this.text += append(choice.delta.content);
    this.reasoning += append(choice.delta.reasoning_content);
    addCalls(choice.delta.tool_calls, this.calls);
    if (choice.finish_reason != null) {
      if (['length', 'insufficient_system_resource', 'aborted'].includes(String(choice.finish_reason)))
        throw truncated();
      if (choice.finish_reason === 'content_filter') throw blocked();
      if (choice.finish_reason !== 'stop' && choice.finish_reason !== 'tool_calls') throw invalid();
      this.finish = choice.finish_reason;
    }
  }
  result(model: string): Turn {
    if (!this.finish || this.calls.size > 0 !== (this.finish === 'tool_calls')) throw invalid();
    const ordered = [...this.calls.entries()].sort(([a], [b]) => a - b);
    if (ordered.some(([index], position) => index !== position)) throw invalid();
    const calls = ordered.map(([, call]) => call);
    return {
      text: this.text,
      calls,
      continuation: {
        role: 'assistant',
        content: this.text || null,
        reasoning_content: this.reasoning,
        tool_calls: calls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.args },
        })),
      },
      usage: usage(this.rawUsage, model, 'prompt_tokens', 'completion_tokens'),
    };
  }
}
async function receive(events: AsyncIterable<Item | null>, model: string): Promise<Turn> {
  const state = new State();
  for await (const event of events) {
    if (event === null) return state.result(model);
    state.add(event);
  }
  throw invalid();
}
export const deepseekCodec: Codec = {
  endpoint: () => 'https://api.deepseek.com/chat/completions',
  headers: (key) => ({ Authorization: `Bearer ${key}` }),
  initial: (request, system) => [
    { role: 'system', content: system },
    { role: 'user', content: request.prompt },
  ],
  body: (model, effort, messages, definitions) => ({
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    thinking: { type: 'enabled' },
    reasoning_effort: effort,
    max_tokens: 16384,
    tools: definitions.map((definition) => ({ type: 'function', function: definition })),
  }),
  receive,
  results: (calls, outputs) =>
    calls.map((call, index) => ({ role: 'tool', tool_call_id: call.id, content: outputs[index]! })),
};
