// 実行の管理（docs/design.md §6 をモック用に）: チャンネルごとのレーン・割り振りの枠・エージェント単位の排他・全体の同時実行上限。
// 状態が変わるたびに activity-changed で ActivityState を流す。
import type { ActivityState } from '@/shared/types/domain';
import { activeAgents } from '../runtime';
import type { Cancel, MockCore } from '../runtime';
import { runJob } from './executor';
import type { JobOutcome } from './executor';
import { pushJob } from './lanes';
import type { MockJob } from './routing';

export const MAX_CONCURRENT_JOBS = 3;

export type JobFilter = (job: MockJob) => boolean;

export interface SchedulerHooks {
  /** ジョブの実行が始まった（サブタスクを running にする） */
  onStarted: (job: MockJob) => void;
  onFinished: (job: MockJob, outcome: JobOutcome) => void;
}

export interface Scheduler {
  /** task は割り振りの枠へ、ほかはレーンへ積む（レーンでは同じエージェントの待機に合流）。始められれば始める */
  enqueue: (job: MockJob) => void;
  /** 合うジョブを待機から除き、実行中なら中断する（結果は捨てる） */
  discard: (matches: JobFilter) => void;
  /** そのエージェントがどこかで待機・実行中か */
  isBusy: (agentId: string) => boolean;
  activityState: () => ActivityState;
}

interface Running {
  job: MockJob;
  /** レーンの順番で動いている（false は割り振りの枠で並行に動いている） */
  lane: boolean;
  detail: string;
  cancel: Cancel;
}

export function createScheduler(core: MockCore, hooks: SchedulerHooks): Scheduler {
  const lanes = new Map<string, MockJob[]>();
  /** 割り振りの枠: チャンネルのレーンの順番を待たずに並行して動く task ジョブ（レーンの待機とは合流しない） */
  let side: MockJob[] = [];
  const running = new Map<number, Running>();
  let nextKey = 0;

  const entries = () => [...running.values()];
  const laneBusy = (channelId: string) => entries().some((entry) => entry.lane && entry.job.channelId === channelId);
  const isRunning = (agentId: string) => entries().some((entry) => entry.job.agentId === agentId);
  const pendingIn = (channelId: string) =>
    (lanes.get(channelId)?.length ?? 0) + side.filter((job) => job.channelId === channelId).length;

  const activityState = (): ActivityState => {
    const channelIds = new Set([...entries().map((entry) => entry.job.channelId), ...lanes.keys(), ...side.map((job) => job.channelId)]);
    return {
      activities: entries().map(({ job, detail }) => ({ agentId: job.agentId, channelId: job.channelId, detail })),
      queues: [...channelIds]
        .map((channelId) => ({
          channelId,
          running: entries().filter((entry) => entry.job.channelId === channelId).length,
          pending: pendingIn(channelId),
        }))
        .filter((queue) => queue.running + queue.pending > 0),
    };
  };
  const publish = () => core.bus.emit('activity-changed', activityState());

  function start(job: MockJob, lane: boolean): void {
    const agent = activeAgents(core).find((candidate) => candidate.id === job.agentId);
    if (!agent) return;
    const key = nextKey++;
    const entry: Running = { job, lane, detail: '考え中…', cancel: () => undefined };
    running.set(key, entry);
    hooks.onStarted(job);
    entry.cancel = runJob(core, job, agent, {
      onActivity(detail) {
        entry.detail = detail;
        publish();
      },
      onDone(outcome) {
        running.delete(key);
        hooks.onFinished(job, outcome);
        pump();
      },
    });
  }

  /** レーンの先頭（レーンが空き、エージェントが他で動いていない）と割り振りの枠を、全体の上限まで始める */
  function pump(): void {
    for (const [channelId, queue] of lanes) {
      const head = queue[0];
      if (!head || laneBusy(channelId) || isRunning(head.agentId)) continue;
      if (running.size >= MAX_CONCURRENT_JOBS) break;
      lanes.set(channelId, queue.slice(1));
      start(head, true);
    }
    for (const job of [...side]) {
      if (running.size >= MAX_CONCURRENT_JOBS) break;
      if (isRunning(job.agentId)) continue;
      side = side.filter((queued) => queued !== job);
      start(job, false);
    }
    publish();
  }

  return {
    enqueue(job) {
      if (job.mode === 'task') side = [...side, job];
      else lanes.set(job.channelId, pushJob(lanes.get(job.channelId) ?? [], job));
      pump();
    },
    discard(matches) {
      for (const [channelId, queue] of lanes) lanes.set(channelId, queue.filter((job) => !matches(job)));
      side = side.filter((job) => !matches(job));
      for (const [key, entry] of [...running]) {
        if (!matches(entry.job)) continue;
        entry.cancel();
        running.delete(key);
      }
      pump();
    },
    isBusy: (agentId) =>
      isRunning(agentId) || side.some((job) => job.agentId === agentId) || [...lanes.values()].some((queue) => queue.some((job) => job.agentId === agentId)),
    activityState,
  };
}
