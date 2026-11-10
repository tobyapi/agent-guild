export interface DelegationStatistics {
  delegations: number;
  subtasks: number;
  reported: number;
  failed: number;
  cancelled: number;
  pending: number;
}

export interface ModelStatistics {
  backend: string;
  model: string | null;
  runs: number;
  totalDurationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  tokenRuns: number;
  estimatedCostNanoUsd: number | null;
  costRuns: number;
}

export interface ChannelStatistics {
  delegation: DelegationStatistics;
  models: ModelStatistics[];
}
