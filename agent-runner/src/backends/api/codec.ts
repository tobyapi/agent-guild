import type { RunUsage } from '../../protocol.ts';
import type { RunRequest } from '../types.ts';
import type { Item } from './json.ts';
import type { Call, Tool } from './tools.ts';

export interface Turn {
  text: string;
  calls: Call[];
  continuation: Item;
  usage?: RunUsage;
}
export interface Codec {
  endpoint(model: string): string;
  headers(key: string): Record<string, string>;
  initial(request: RunRequest, system: string): Item[];
  body(model: string, effort: string, history: Item[], tools: Tool[]): Item;
  receive(events: AsyncIterable<Item | null>, model: string): Promise<Turn>;
  results(calls: Call[], outputs: string[]): Item[];
}
