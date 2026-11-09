// 会話の振り分け（docs/design.md §7）をモック用に再現する純粋な関数。結果は「起こすこと」の一覧で返す。
import { HUMAN_ID } from '@/shared/types/domain';
import type { Agent, BackendInfo, Channel, Message, UnmentionedPolicy } from '@/shared/types/domain';
import { NO_RESPONDER, undeliverable } from '../notices';

export const MAX_DEPTH = 10;

/** task: 割り振られたサブタスク（レーンの外で並行に動く）/ report: マネージャーのまとめ（レーンに積む） */
export type JobMode = 'reply' | 'return' | 'autonomous' | 'task' | 'report';

/** 割り振りとの結びつき（task はサブタスク、report は割り振り全体） */
export interface JobDelegation {
  delegationId: string;
  subtaskId: string | null;
}

export interface MockJob {
  agentId: string;
  channelId: string;
  mode: JobMode;
  /** きっかけの発言（合流すると複数になる） */
  triggers: Message[];
  /** 呼び出し元。返答したら return ジョブで戻す */
  returnTo: string[];
  /** 生まれる返答の depth */
  depth: number;
  /** 会話の起点。自発活動は投稿した発言自身が起点になるので null */
  rootId: string | null;
  /** return ジョブに添える注記（「ロジカ は回答しませんでした」など）。task は指示、report はサブタスクごとの結果 */
  notes: string[];
  delegation: JobDelegation | null;
}

export interface RoutingContext {
  channel: Channel;
  /** 削除されていないエージェント（作成順） */
  agents: readonly Agent[];
  backends: readonly BackendInfo[];
}

export type RoutingEffect =
  { type: 'join'; agentId: string } | { type: 'enqueue'; job: MockJob } | { type: 'notice'; content: string };

function jobFrom(trigger: Message, agentId: string, mode: JobMode, returnTo: string[], notes: string[] = []): MockJob {
  return {
    agentId,
    channelId: trigger.channelId,
    mode,
    triggers: [trigger],
    returnTo,
    depth: trigger.depth + 1,
    rootId: trigger.rootId,
    notes,
    delegation: null,
  };
}

const enqueue = (job: MockJob): RoutingEffect => ({ type: 'enqueue', job });
const isMember = (ctx: RoutingContext, id: string) => ctx.channel.memberIds.includes(id);
const isReady = (ctx: RoutingContext, agent: Agent) =>
  ctx.backends.some((backend) => backend.id === agent.backend && backend.status === 'ready');

/** 上の段に1人でも該当者がいれば、下の段の人は答えない（ignore は答えない） */
const RESPONDER_TIERS: readonly UnmentionedPolicy[] = ['lead', 'answer', 'fallback'];

/** メンションなしの人間の発言に答える人: メンバーでバックエンドが ready のうち、lead → answer → fallback の最初の段の全員（作成順） */
export function defaultResponders(ctx: RoutingContext): Agent[] {
  const candidates = ctx.agents.filter((agent) => isMember(ctx, agent.id) && isReady(ctx, agent));
  for (const tier of RESPONDER_TIERS) {
    const responders = candidates.filter((agent) => agent.unmentioned === tier);
    if (responders.length > 0) return responders;
  }
  return [];
}

/** 人間の発言（§7-1）: メンションされた全員（チャンネル外なら参加させる）→ なければ既定の返答者 */
export function routeHumanMessage(message: Message, ctx: RoutingContext): RoutingEffect[] {
  if (message.mentions.length > 0) {
    const mentioned = message.mentions.flatMap((id) => ctx.agents.filter((agent) => agent.id === id));
    return mentioned.flatMap((agent) => [
      ...(isMember(ctx, agent.id) ? [] : [{ type: 'join', agentId: agent.id } as const]),
      enqueue(jobFrom(message, agent.id, 'reply', [])),
    ]);
  }
  const responders = defaultResponders(ctx);
  if (responders.length === 0) return [{ type: 'notice', content: NO_RESPONDER }];
  return responders.map((agent) => enqueue(jobFrom(message, agent.id, 'reply', [])));
}

/** 戻す相手: 呼び出し元のうち、自分以外で削除されておらずチャンネルにいる人 */
function returnTargets(job: MockJob, selfId: string, ctx: RoutingContext): string[] {
  return job.returnTo.filter((id) => id !== selfId && isMember(ctx, id) && ctx.agents.some((agent) => agent.id === id));
}

/** 新しい相談: メンバーなら返答を頼む。いなければ相談相手になる設定（consultable）の人だけ参加させる */
function consult(agentId: string, reply: Message, ctx: RoutingContext): RoutingEffect[] {
  const agent = ctx.agents.find((candidate) => candidate.id === agentId);
  if (!agent) return [];
  const job = enqueue(jobFrom(reply, agentId, 'reply', [reply.authorId]));
  if (isMember(ctx, agentId)) return [job];
  if (agent.consultable) return [{ type: 'join', agentId }, job];
  return [{ type: 'notice', content: undeliverable(agent.name) }];
}

/** エージェントの返答（§7-2）: 呼び出し元へ必ず戻し、新しくメンションした相手に相談する。depth の上限は呼び出し側で確かめる */
export function routeAgentReply(reply: Message, job: MockJob, ctx: RoutingContext): RoutingEffect[] {
  const returns = returnTargets(job, reply.authorId, ctx).map((id) => enqueue(jobFrom(reply, id, 'return', [])));
  const consulted = reply.mentions.filter(
    (id) => id !== reply.authorId && id !== HUMAN_ID && !job.returnTo.includes(id),
  );
  return [...returns, ...consulted.flatMap((id) => consult(id, reply, ctx))];
}

/** 返答がなかったとき（§7-3）: 呼び出し元へ注記つきで戻す */
export function routeMissingReply(job: MockJob, note: string, ctx: RoutingContext): RoutingEffect[] {
  const trigger = job.triggers.at(-1);
  if (!trigger) return [];
  return returnTargets(job, job.agentId, ctx).map((id) => enqueue(jobFrom(trigger, id, 'return', [], [note])));
}
