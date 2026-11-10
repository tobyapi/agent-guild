import type { ChannelStatistics, DelegationStatistics, ModelStatistics } from '../domain';
import { arrayOf, nullable, number, objectOf, string, type Schema } from '../schema';

const delegation = {
  delegations: number,
  subtasks: number,
  reported: number,
  failed: number,
  cancelled: number,
  pending: number,
} satisfies Schema<DelegationStatistics>;

const model = {
  backend: string,
  model: nullable(string),
  runs: number,
  totalDurationMs: number,
  inputTokens: nullable(number),
  outputTokens: nullable(number),
  tokenRuns: number,
  estimatedCostNanoUsd: nullable(number),
  costRuns: number,
} satisfies Schema<ModelStatistics>;

export const channelStatisticsSchema = {
  delegation: objectOf(delegation),
  models: arrayOf(objectOf(model)),
} satisfies Schema<ChannelStatistics>;
