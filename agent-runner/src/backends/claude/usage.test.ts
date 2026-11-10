import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { expect, it } from 'vitest';
import { claudeUsage } from './usage.ts';

it('キャッシュを含む全モデルのトークンと SDK の推定費用を数える', () => {
  const model: SDKResultMessage['modelUsage'][string] = {
    inputTokens: 10,
    cacheReadInputTokens: 100,
    cacheCreationInputTokens: 5,
    outputTokens: 20,
    webSearchRequests: 0,
    costUSD: 0.001,
    contextWindow: 1000,
    maxOutputTokens: 100,
  };
  expect(claudeUsage({ modelUsage: { sonnet: model, haiku: model }, total_cost_usd: 0.002 })).toEqual({
    inputTokens: 230,
    outputTokens: 40,
    estimatedCostNanoUsd: 2_000_000,
  });
  expect(claudeUsage({ modelUsage: {}, total_cost_usd: 0 }).estimatedCostNanoUsd).toBeUndefined();
});
