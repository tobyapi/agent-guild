import { invalid, object, type Response } from './response.ts';
import type { RunUsage } from '../../protocol.ts';

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid();
  return value;
}

/** Provider total already includes server tools. Keep ticks integral until display. */
export class Usage {
  ticks = 0;
  input = 0;
  output = 0;
  cached = 0;
  web = 0;
  posts = 0;
  users = 0;
  private readonly seen = new Set<string>();

  add(response: Response, model: string): RunUsage | null {
    if (this.seen.has(response.id)) return null;
    const usage = response.usage;
    const ticks = count(usage.cost_in_usd_ticks);
    const input = count(usage.input_tokens);
    const output = count(usage.output_tokens);
    const details = object(usage.input_tokens_details) ? usage.input_tokens_details : {};
    const tools = object(usage.server_side_tool_usage_details) ? usage.server_side_tool_usage_details : {};
    const cached = count(details.cached_tokens ?? 0);
    const web = count(tools.web_search_calls ?? 0);
    const posts = count(tools.x_posts_fetched ?? 0);
    const users = count(tools.x_users_fetched ?? 0);
    count(this.ticks + ticks);
    this.seen.add(response.id);
    this.ticks += ticks;
    this.input += input;
    this.output += output;
    this.cached += cached;
    this.web += web;
    this.posts += posts;
    this.users += users;
    return { model, inputTokens: input, outputTokens: output, estimatedCostNanoUsd: Math.round(ticks / 10) };
  }
}
