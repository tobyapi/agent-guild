// 会話の進行（モック）: 発言を振り分け（routing）、起点ごとの上限を守ってジョブを積み（scheduler）、
// 結果をまた振り分ける。割り振り（delegation）の進行と、チャンネル外の相手の参加・システム発言もここでつなぐ。
import type { ActivityState, Channel, Message } from '@/shared/types/domain';
import { createDelegations } from '../delegation/engine';
import type { MockDelegations } from '../delegation/engine';
import { activeAgents, emitStateChanged, joinChannel, postSystem } from '../runtime';
import type { MockCore } from '../runtime';
import type { JobOutcome } from './executor';
import {
  DEPTH_LIMIT_NOTICE,
  MAX_DEPTH,
  MAX_JOBS_PER_ROOT,
  ROOT_LIMIT_NOTICE,
  routeAgentReply,
  routeHumanMessage,
  routeMissingReply,
} from './routing';
import type { MockJob, RoutingContext, RoutingEffect } from './routing';
import { createScheduler } from './scheduler';
import type { Scheduler } from './scheduler';

export const STOPPED_NOTICE = '停止しました';
const MANAGER_GONE = 'マネージャーが外れました';

export interface MockConversation {
  activityState: () => ActivityState;
  onHumanMessage: (message: Message, channel: Channel) => void;
  /** 自発活動を1回積む（そのエージェントがどこかで待機・実行中なら積まない） */
  queueAutonomous: (agentId: string, channelId: string) => void;
  /** 待機を捨て、実行中を中断し、割り振りを打ち切って「停止しました」を出す */
  stop: (channelId: string) => void;
  dropChannel: (channelId: string) => void;
  dropAgent: (agentId: string) => void;
  dropMember: (channelId: string, agentId: string) => void;
}

type Cancellations = Pick<MockConversation, 'stop' | 'dropChannel' | 'dropAgent' | 'dropMember'>;

/** 停止・削除・除外: 待機と実行中のジョブを捨て、割り振りを打ち切る（担当者が外れたらそのサブタスクは失敗） */
function cancellations(core: MockCore, scheduler: Scheduler, delegations: MockDelegations): Cancellations {
  return {
    stop(channelId) {
      scheduler.discard((job) => job.channelId === channelId);
      delegations.cancel((delegation) => delegation.channelId === channelId, STOPPED_NOTICE);
      postSystem(core, channelId, STOPPED_NOTICE);
    },
    dropChannel(channelId) {
      scheduler.discard((job) => job.channelId === channelId);
      delegations.cancel((delegation) => delegation.channelId === channelId, 'チャンネルが削除されました');
    },
    dropAgent(agentId) {
      scheduler.discard((job) => job.agentId === agentId);
      delegations.cancel((delegation) => delegation.managerId === agentId, MANAGER_GONE);
      delegations.dropAssignee(agentId, null);
    },
    dropMember(channelId, agentId) {
      scheduler.discard((job) => job.channelId === channelId && job.agentId === agentId);
      delegations.cancel((delegation) => delegation.channelId === channelId && delegation.managerId === agentId, MANAGER_GONE);
      delegations.dropAssignee(agentId, channelId);
    },
  };
}

export function createConversation(core: MockCore): MockConversation {
  const rootCounts = new Map<string, number>();
  const notified = new Set<string>();
  const scheduler = createScheduler(core, {
    onStarted: (job) => delegations.started(job),
    onFinished: (job, outcome) => settle(job, outcome),
  });
  const contextOf = (channel: Channel): RoutingContext => ({
    channel,
    agents: activeAgents(core),
    backends: core.state.backends,
  });

  function noticeOnce(channelId: string, rootId: string, content: string): void {
    const key = `${rootId}\n${content}`;
    if (notified.has(key)) return;
    notified.add(key);
    postSystem(core, channelId, content, rootId);
  }

  /** 1つの起点から生まれるジョブは MAX_JOBS_PER_ROOT 件まで（超えたら1回だけ知らせて false） */
  function enqueue(job: MockJob): boolean {
    if (job.rootId !== null) {
      const count = rootCounts.get(job.rootId) ?? 0;
      if (count >= MAX_JOBS_PER_ROOT) {
        noticeOnce(job.channelId, job.rootId, ROOT_LIMIT_NOTICE);
        return false;
      }
      rootCounts.set(job.rootId, count + 1);
    }
    scheduler.enqueue(job);
    return true;
  }

  function join(channel: Channel, agentId: string, rootId: string): boolean {
    const agent = activeAgents(core).find((candidate) => candidate.id === agentId);
    if (!agent || channel.memberIds.includes(agentId)) return false;
    joinChannel(core, channel, agent, rootId);
    return true;
  }

  const delegations = createDelegations(core, { enqueue, join });

  function apply(effects: RoutingEffect[], channel: Channel, rootId: string): void {
    let joined = false;
    for (const effect of effects) {
      if (effect.type === 'enqueue') enqueue(effect.job);
      else if (effect.type === 'notice') postSystem(core, channel.id, effect.content, rootId);
      else joined = join(channel, effect.agentId, rootId) || joined;
    }
    if (joined) emitStateChanged(core);
  }

  function settle(job: MockJob, outcome: JobOutcome): void {
    const channel = core.state.channels.find((candidate) => candidate.id === job.channelId);
    if (!channel) return;
    delegations.finished(job, outcome);
    if (outcome.type !== 'reply') {
      return apply(routeMissingReply(job, outcome.note, contextOf(channel)), channel, job.rootId ?? '');
    }
    const reply = outcome.message;
    if (outcome.tasks) delegations.create(reply, outcome.tasks, channel);
    if (reply.depth >= MAX_DEPTH) return noticeOnce(channel.id, reply.rootId, DEPTH_LIMIT_NOTICE);
    apply(routeAgentReply(reply, job, contextOf(channel)), channel, reply.rootId);
  }

  return {
    activityState: scheduler.activityState,
    onHumanMessage: (message, channel) => apply(routeHumanMessage(message, contextOf(channel)), channel, message.id),
    queueAutonomous(agentId, channelId) {
      if (scheduler.isBusy(agentId)) return;
      enqueue({ agentId, channelId, mode: 'autonomous', triggers: [], returnTo: [], depth: 1, rootId: null, notes: [], delegation: null });
    },
    ...cancellations(core, scheduler, delegations),
  };
}
