import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import type { RunUsage } from '../../protocol.ts';
import { count, nanoUsd } from '../../usage.ts';

/** query() の最新結果だけを読む。modelUsage は SDK 内の補助モデルの消費も含む。 */
export function claudeUsage(result: Pick<SDKResultMessage, 'modelUsage' | 'total_cost_usd'>): RunUsage {
  const models = Object.values(result.modelUsage ?? {});
  if (models.length === 0) return { estimatedCostNanoUsd: nanoUsd(result.total_cost_usd || undefined) };
  const input = models.reduce(
    (total, model) => total + model.inputTokens + model.cacheReadInputTokens + model.cacheCreationInputTokens,
    0,
  );
  const output = models.reduce((total, model) => total + model.outputTokens, 0);
  return {
    inputTokens: count(input),
    outputTokens: count(output),
    estimatedCostNanoUsd: nanoUsd(result.total_cost_usd),
  };
}
