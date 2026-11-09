// レーン（チャンネルごとの待ち行列）での合流規則（docs/design.md §6）。純粋な関数。
import type { JobMode, MockJob } from './routing';

/** 合流するモードの強さ（task と report は合流しない） */
const MODE_RANK: Partial<Record<JobMode, number>> = { reply: 3, return: 2, autonomous: 1 };

const rank = (mode: JobMode) => MODE_RANK[mode] ?? 0;
const mergeable = (job: MockJob) => MODE_RANK[job.mode] !== undefined;

function unique<T>(items: readonly T[], keyOf: (item: T) => string = String): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 同じエージェントの待機ジョブを1件にまとめる:
 * きっかけは集合、モードは reply > return > autonomous で上書き、returnTo は和集合、depth は最大値。
 */
export function mergeJobs(current: MockJob, incoming: MockJob): MockJob {
  return {
    ...current,
    mode: rank(incoming.mode) > rank(current.mode) ? incoming.mode : current.mode,
    triggers: unique([...current.triggers, ...incoming.triggers], (message) => message.id),
    returnTo: unique([...current.returnTo, ...incoming.returnTo]),
    depth: Math.max(current.depth, incoming.depth),
    rootId: current.rootId ?? incoming.rootId,
    notes: unique([...current.notes, ...incoming.notes]),
  };
}

/** 待ち行列の末尾に積む。同じエージェントが待っていれば、そのジョブに合流させる（report は合流させない） */
export function pushJob(queue: readonly MockJob[], job: MockJob): MockJob[] {
  const index = mergeable(job) ? queue.findIndex((queued) => queued.agentId === job.agentId && mergeable(queued)) : -1;
  if (index < 0) return [...queue, job];
  return queue.map((queued, position) => (position === index ? mergeJobs(queued, job) : queued));
}
