import { afterEach, expect, it, vi } from 'vitest';
import { client } from './client.ts';
import { citations } from './citations.ts';
import { Usage } from './usage.ts';
import type { Response as GrokResponse } from './response.ts';

const value = (): GrokResponse => ({
  id: 'one',
  status: 'completed',
  output: [],
  usage: {
    cost_in_usd_ticks: 1234,
    input_tokens: 12,
    output_tokens: 3,
    input_tokens_details: { cached_tokens: 2 },
    server_side_tool_usage_details: { web_search_calls: 1, x_posts_fetched: 4, x_users_fetched: 2 },
  },
});
afterEach(() => vi.unstubAllGlobals());
it('counts the provider total once including cached and server tool usage', () => {
  const usage = new Usage();
  expect(usage.add(value(), 'test')).toMatchObject({ estimatedCostNanoUsd: 123, inputTokens: 12, outputTokens: 3 });
  expect(usage.add(value(), 'test')).toBeNull();
  expect(usage).toMatchObject({ ticks: 1234, cached: 2, web: 1, posts: 4, users: 2 });
});
it.each([1, 3])('accounts for %i Web searches with zero results without adding tool fees again', (web) => {
  const response = value();
  response.output = Array.from({ length: web }, () => ({ type: 'web_search_call', action: { sources: [] } }));
  response.usage.server_side_tool_usage_details = { web_search_calls: web, x_posts_fetched: 0, x_users_fetched: 0 };
  const usage = new Usage();
  expect(usage.add(response, 'test')).toMatchObject({ estimatedCostNanoUsd: 123 });
  expect(usage).toMatchObject({ ticks: 1234, web, posts: 0, users: 0 });
  expect(citations(response.output)).toEqual([]);
});
it.each([undefined, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('fails closed on missing or invalid cost %s', (cost) => {
  const response = value();
  response.usage.cost_in_usd_ticks = cost;
  expect(() => new Usage().add(response, 'test')).toThrow();
});
it('normalizes and deduplicates sources, rejects unsafe URLs and accepts zero positions as references', () => {
  expect(
    citations([
      {
        type: 'message',
        content: [
          {
            annotations: [
              { url: 'https://example.com', start_index: 0, end_index: 0 },
              { url: 'javascript:alert(1)' },
              { url: 'https://user:pass@example.com' },
              { url: 'https://example.com/\n' },
            ],
          },
        ],
        citations: [{ url: 'https://example.com/' }],
        action: { sources: [{ url: 'https://other.example/' }] },
      },
    ]),
  ).toEqual(['https://other.example/', 'https://example.com/']);
});
it.each([
  'not-json',
  'data: {"type":"response.completed"}\n\n',
  JSON.stringify({ ...value(), status: 'incomplete' }),
  JSON.stringify({ ...value(), usage: null }),
])('rejects invalid JSON, SSE or incomplete response without retry', async (body) => {
  const fetcher = vi.fn().mockResolvedValue(new Response(body));
  vi.stubGlobal('fetch', fetcher);
  await expect(client('canary')({}, new AbortController().signal)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('bounds response bytes even without Content-Length', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x'.repeat(4 * 1024 * 1024 + 1))));
  await expect(client('canary')({}, new AbortController().signal)).rejects.toThrow();
});
