// 割り振りの進行（docs/design.md §7.1 をモック用に）: 作成・サブタスクの開始と決着・待ち合わせ・まとめ・打ち切り。
// 変わるたびに delegation-changed で全体の最新の値を流す。
import type { Channel, Delegation, Message } from '@/shared/types/domain';
import type { JobOutcome } from '../conversation/executor';
import type { MockJob } from '../conversation/routing';
import { activeAgents, emitStateChanged, postSystem } from '../runtime';
import type { MockCore } from '../runtime';
import { allSettled, cancelDelegation, isOpen, isUnsettled, reportLines, settleSubtask, startSubtask } from './model';
import type { SubtaskResult } from './model';
import { MAX_SUBTASKS } from './tasks';
import type { ParsedTasks } from './tasks';

export interface DelegationDeps {
  /** ジョブを積む（起点ごとの上限で積めなければ false） */
  enqueue: (job: MockJob) => boolean;
  /** チャンネル外の相手を参加させる（参加させたら true） */
  join: (channel: Channel, agentId: string, rootId: string) => boolean;
}

export interface MockDelegations {
  /** 割り振れるエージェントの返答の tasks ブロックから割り振りを作る */
  create: (reply: Message, tasks: ParsedTasks, channel: Channel) => void;
  started: (job: MockJob) => void;
  finished: (job: MockJob, outcome: JobOutcome) => void;
  /** 打ち切る（停止・チャンネル削除・マネージャーの削除や除外） */
  cancel: (matches: (delegation: Delegation) => boolean, note: string) => void;
  /** 担当者が外れた: その人の未決着のサブタスクを失敗にする */
  dropAssignee: (agentId: string, channelId: string | null) => void;
}

function outcomeResult(outcome: JobOutcome): SubtaskResult {
  if (outcome.type === 'reply') return { status: 'done', resultMessageId: outcome.message.id, note: null };
  if (outcome.type === 'failed') return { status: 'failed', resultMessageId: outcome.message.id, note: '失敗しました' };
  return { status: 'failed', resultMessageId: null, note: '回答がありませんでした' };
}

export function createDelegations(core: MockCore, deps: DelegationDeps): MockDelegations {
  const now = () => core.env.now();
  const find = (id: string) => core.state.delegations.find((delegation) => delegation.id === id);
  const messageOf = (id: string | null) => core.state.messages.find((message) => message.id === id);
  const nameOf = (agentId: string) => core.state.agents.find((agent) => agent.id === agentId)?.name ?? agentId;

  function save(next: Delegation): void {
    core.state.delegations = core.state.delegations.map((delegation) => (delegation.id === next.id ? next : delegation));
    core.bus.emit('delegation-changed', next);
  }

  /** 全員が決着したらまとめのジョブをマネージャーのレーンに積む（マネージャーがいなければ打ち切り） */
  function report(delegation: Delegation): void {
    const plan = messageOf(delegation.messageId);
    const channel = core.state.channels.find((candidate) => candidate.id === delegation.channelId);
    const managerHere = activeAgents(core).some((agent) => agent.id === delegation.managerId) && channel?.memberIds.includes(delegation.managerId);
    if (!plan || !managerHere) return save(cancelDelegation(delegation, 'マネージャーが外れました', now()));
    save({ ...delegation, status: 'reporting', updatedAt: now() });
    const results = delegation.subtasks.flatMap((subtask) => messageOf(subtask.resultMessageId) ?? []);
    const lines = reportLines(delegation, nameOf, (subtask) => messageOf(subtask.resultMessageId)?.content ?? null);
    const depth = Math.max(plan.depth, ...results.map((message) => message.depth)) + 1;
    const job: MockJob = { agentId: delegation.managerId, channelId: delegation.channelId, mode: 'report', triggers: results.length > 0 ? results : [plan], returnTo: [], depth, rootId: plan.rootId, notes: lines, delegation: { delegationId: delegation.id, subtaskId: null } };
    const latest = find(delegation.id);
    if (!deps.enqueue(job) && latest) save({ ...latest, status: 'done', updatedAt: now() });
  }

  function settle(delegationId: string, subtaskId: string, result: SubtaskResult): void {
    const delegation = find(delegationId);
    if (delegation?.status !== 'running') return;
    const next = settleSubtask(delegation, subtaskId, result, now());
    if (!allSettled(next)) return save(next);
    report(next);
  }

  function notice(reply: Message, tasks: ParsedTasks): void {
    if (tasks.skipped.length > 0) postSystem(core, reply.channelId, `${tasks.skipped.join('、')} には割り振れませんでした（見つからないか、自分自身です）`, reply.rootId);
    if (tasks.overflow.length > 0) {
      postSystem(core, reply.channelId, `サブタスクは${MAX_SUBTASKS}件までなので、${tasks.overflow.join('、')} には割り振りませんでした`, reply.rootId);
    }
  }

  return {
    create(reply, tasks, channel) {
      notice(reply, tasks);
      if (reply.delegationId === null || tasks.entries.length === 0) return;
      const subtasks = tasks.entries.map((entry) => ({ id: core.env.newId(), ...entry, status: 'pending' as const, resultMessageId: null, note: null }));
      const delegation: Delegation = { id: reply.delegationId, channelId: channel.id, managerId: reply.authorId, messageId: reply.id, status: 'running', subtasks, summaryMessageId: null, createdAt: now(), updatedAt: now() };
      core.state.delegations.push(delegation);
      core.bus.emit('delegation-changed', delegation);
      const joined = subtasks.map((subtask) => deps.join(channel, subtask.assigneeId, reply.rootId)).some(Boolean);
      if (joined) emitStateChanged(core);
      for (const subtask of subtasks) {
        const job: MockJob = { agentId: subtask.assigneeId, channelId: channel.id, mode: 'task', triggers: [reply], returnTo: [], depth: reply.depth + 1, rootId: reply.rootId, notes: [subtask.instruction], delegation: { delegationId: delegation.id, subtaskId: subtask.id } };
        if (!deps.enqueue(job)) settle(delegation.id, subtask.id, { status: 'failed', resultMessageId: null, note: 'この会話の返答回数が上限に達しました' });
      }
    },
    started(job) {
      const delegation = job.mode === 'task' && job.delegation?.subtaskId ? find(job.delegation.delegationId) : undefined;
      if (delegation?.status === 'running' && job.delegation?.subtaskId) save(startSubtask(delegation, job.delegation.subtaskId, now()));
    },
    finished(job, outcome) {
      if (!job.delegation) return;
      if (job.mode === 'task' && job.delegation.subtaskId) return settle(job.delegation.delegationId, job.delegation.subtaskId, outcomeResult(outcome));
      const delegation = find(job.delegation.delegationId);
      if (job.mode !== 'report' || delegation?.status !== 'reporting') return;
      save({ ...delegation, status: 'done', summaryMessageId: outcome.type === 'reply' ? outcome.message.id : null, updatedAt: now() });
    },
    cancel(matches, note) {
      for (const delegation of core.state.delegations.filter((candidate) => isOpen(candidate) && matches(candidate))) {
        save(cancelDelegation(delegation, note, now()));
      }
    },
    dropAssignee(agentId, channelId) {
      for (const delegation of core.state.delegations.filter((candidate) => candidate.status === 'running' && (channelId === null || candidate.channelId === channelId))) {
        const mine = delegation.subtasks.filter((subtask) => subtask.assigneeId === agentId && isUnsettled(subtask));
        for (const subtask of mine) settle(delegation.id, subtask.id, { status: 'failed', resultMessageId: null, note: '担当者が外れました' });
      }
    },
  };
}
