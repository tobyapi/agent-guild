import { BackendError, type RunContext } from '../types.ts';
import type { Send } from './client.ts';
import { finalText, invalid, type Item } from './response.ts';
import { Usage } from './usage.ts';
import { citations } from './citations.ts';

export interface Loop {
  model: string;
  input: Item[];
  tools: () => Item[];
  execute: (name: string, args: string) => Promise<string>;
  send: Send;
  context: RunContext;
  budgetTicks?: number;
}

function requireState(output: Item[]): void {
  if (output.some(item => item.type === 'function_call') && !output.some(item => item.type === 'reasoning')) {
    throw new BackendError('internal', 'Grok encrypted continuation state is missing; stopped.');
  }
  for (const item of output) {
    if (item.type === 'reasoning' && (typeof item.encrypted_content !== 'string' || !item.encrypted_content)) {
      throw new BackendError('internal', 'Grok encrypted continuation state is missing; stopped.');
    }
  }
}

function validateOutput(output: Item[], tools: Item[]): void {
  const web = tools.some(tool => tool.type === 'web_search');
  const x = tools.some(tool => tool.type === 'x_search');
  const xNames = ['x_keyword_search', 'x_semantic_search', 'x_user_search', 'x_thread_fetch'];
  for (const item of output) {
    if (['reasoning', 'message', 'function_call'].includes(String(item.type))) continue;
    if (item.type === 'web_search_call' && web) continue;
    if (item.type === 'x_search_call' && x) continue;
    if (item.type === 'custom_tool_call' && x && xNames.includes(String(item.name))) continue;
    throw invalid();
  }
}

function parsedCall(item: Item): { id: string; name: string; args: string } {
  const { call_id: id, name, arguments: args } = item;
  if (typeof id !== 'string' || !id || typeof name !== 'string' || typeof args !== 'string' || args.length > 32768) throw invalid();
  return { id, name, args };
}

async function calls(output: Item[], loop: Loop, ledger: Map<string, { signature: string; result: string }>): Promise<Item[]> {
  const results: Item[] = [];
  for (const item of output.filter(item => item.type === 'function_call')) {
    loop.context.signal.throwIfAborted();
    const { id, name, args } = parsedCall(item);
    const signature = JSON.stringify([name, args]);
    const previous = ledger.get(id);
    if (previous && previous.signature !== signature) throw invalid();
    if (!previous && ledger.size >= 20) throw invalid();
    const result = previous?.result ?? await loop.execute(name, args);
    ledger.set(id, { signature, result });
    results.push({ type: 'function_call_output', call_id: id, output: result });
  }
  return results;
}

/** History, encrypted state and call ledger exist only for this invocation. No retries. */
export async function runLoop(loop: Loop): Promise<{ text: string; usage: Usage }> {
  const history = [...loop.input];
  const ledger = new Map<string, { signature: string; result: string }>();
  const usage = new Usage();
  const sources = new Set<string>();
  const budget = loop.budgetTicks ?? 2_000_000_000;
  try {
    for (let turn = 0; turn < 10; turn++) {
      loop.context.signal.throwIfAborted();
      if (usage.ticks >= budget) throw new BackendError('rate_limit', 'Grok turn budget reached; next request stopped.');
      if (Buffer.byteLength(JSON.stringify(history)) > 2 * 1024 * 1024) throw invalid();
      loop.context.onActivity('Grok');
      const definitions = loop.tools();
      const response = await loop.send({ model: loop.model, input: history, tools: definitions,
        include: ['reasoning.encrypted_content'], max_output_tokens: 1600, max_tool_calls: 1 }, loop.context.signal);
      loop.context.signal.throwIfAborted();
      const increment = usage.add(response, loop.model);
      if (increment) loop.context.onUsage(increment);
      validateOutput(response.output, definitions);
      requireState(response.output);
      for (const url of citations(response.output)) sources.add(url);
      history.push(...response.output);
      const results = await calls(response.output, loop, ledger);
      if (!results.length) {
        const text = finalText(response.output);
        const extra = [...sources].filter(url => !text.includes(url));
        return { text: extra.length ? `${text}\n\nSources:\n${extra.map(url => `- ${url}`).join('\n')}` : text, usage };
      }
      history.push(...results);
    }
    throw new BackendError('internal', 'Grok request limit reached.');
  } finally {
    history.length = 0;
    ledger.clear();
  }
}
