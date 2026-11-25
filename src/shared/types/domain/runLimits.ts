export const RUN_TIMEOUT_MINUTES = [30, 60, 120] as const;
export const MAX_CONCURRENT_JOBS = 10;

export interface RunLimits {
  timeoutMinutes: (typeof RUN_TIMEOUT_MINUTES)[number] | null;
  maxConcurrentJobs: number | null;
}

export const DEFAULT_RUN_LIMITS: Readonly<RunLimits> = { timeoutMinutes: null, maxConcurrentJobs: null };
