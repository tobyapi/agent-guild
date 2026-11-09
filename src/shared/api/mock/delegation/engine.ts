// 割り振りの進行（docs/design.md §7.1 をモック用に）: 作成・サブタスクの開始と決着・待ち合わせ・まとめ・打ち切り。
// 変わるたびに delegation-changed で全体の最新の値を流す。
import type { Channel, Delegation, Message } from '@/shared/types/domain';
import type { JobOutcome } from '../conversation/executor';
import type { MockJob } from '../conversation/routing';
import { activeAgents, emitStateChanged, postSystem } from '../runtime';
import type { MockCore } from '../runtime';
import { allSettled, cancelDelegation, isOpen, isUnsettled, reportLines, settleSubtask, startSubtask } from './model';
import type { SubtaskResult } from './model';
import { SUBTASK_NOTES, tooManyTasks, unassignable } from '../notices';
import type { ParsedTasks } from './tasks';

export interface DelegationDeps {
  /** ジョブを積む */
  enqueue: (job: MockJob) => void;
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
  if (outcome.type === 'failed')
    return { status: 'failed', resultMessageId: outcome.message.id, note: SUBTASK_NOTES.runFailed };
  return { status: 'failed', resultMessageId: null, note: SUBTASK_NOTES.noAnswer };
}

/** 割り振れなかった名前と、上限を超えて飛ばした担当者を知らせる */
function notice(core: MockCore, reply: Message, tasks: ParsedTasks): void {
  if (tasks.skipped.length > 0) postSystem(core, reply.channelId, unassignable(tasks.skipped), reply.rootId);
  if (tasks.overflow.length > 0) postSystem(core, reply.channelId, tooManyTasks(tasks.overflow), reply.rootId);
}

/** マネージャーの返答 reply の tasks ブロックから作る割り振り（サブタスクはすべて pending） */
function newDelegation(core: MockCore, id: string, reply: Message, tasks: ParsedTasks): Delegation {
  const now = core.env.now();
  return {
    id,
    channelId: reply.channelId,
    managerId: reply.authorId,
    messageId: reply.id,
    status: 'running',
    subtasks: tasks.entries.map((entry) => ({
      id: core.env.newId(),
      ...entry,
      status: 'pending' as const,
      resultMessageId: null,
      note: null,
    })),
    summaryMessageId: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** サブタスクの担当者の task ジョブ（きっかけはマネージャーの返答、注記は指示） */
function taskJob(reply: Message, delegationId: string, subtask: Delegation['subtasks'][number]): MockJob {
  return {
    agentId: subtask.assigneeId,
    channelId: reply.channelId,
    mode: 'task',
    triggers: [reply],
    returnTo: [],
    depth: reply.depth + 1,
    rootId: reply.rootId,
    notes: [subtask.instruction],
    delegation: { delegationId, subtaskId: subtask.id },
  };
}

/** マネージャーのまとめのジョブ（きっかけは各サブタスクの結果の発言。なければ割り振った返答 plan） */
function reportJob(delegation: Delegation, plan: Message, results: Message[], lines: string[]): MockJob {
  return {
    agentId: delegation.managerId,
    channelId: delegation.channelId,
    mode: 'report',
    triggers: results.length > 0 ? results : [plan],
    returnTo: [],
    depth: Math.max(plan.depth, ...results.map((message) => message.depth)) + 1,
    rootId: plan.rootId,
    notes: lines,
    delegation: { delegationId: delegation.id, subtaskId: null },
  };
}

/** 担当者が外れたサブタスクの決着 */
const ASSIGNEE_DROPPED: SubtaskResult = {
  status: 'failed',
  resultMessageId: null,
  note: SUBTASK_NOTES.assigneeRemoved,
};

export function createDelegations(core: MockCore, deps: DelegationDeps): MockDelegations {
  const now = () => core.env.now();
  const find = (id: string) => core.state.delegations.find((delegation) => delegation.id === id);
  const messageOf = (id: string | null) => core.state.messages.find((message) => message.id === id);
  const nameOf = (agentId: string) => core.state.agents.find((agent) => agent.id === agentId)?.name ?? agentId;

  function save(next: Delegation): void {
    core.state.delegations = core.state.delegations.map((delegation) =>
      delegation.id === next.id ? next : delegation,
    );
    core.bus.emit('delegation-changed', next);
  }

  /** 全員が決着したらまとめのジョブをマネージャーのレーンに積む（マネージャーがいなければ打ち切り） */
  function report(delegation: Delegation): void {
    const plan = messageOf(delegation.messageId);
    const channel = core.state.channels.find((candidate) => candidate.id === delegation.channelId);
    const managerHere =
      activeAgents(core).some((agent) => agent.id === delegation.managerId) &&
      channel?.memberIds.includes(delegation.managerId);
    if (!plan || !managerHere) return save(cancelDelegation(delegation, 'マネージャーが外れました', now()));
    save({ ...delegation, status: 'reporting', updatedAt: now() });
    const results = delegation.subtasks.flatMap((subtask) => messageOf(subtask.resultMessageId) ?? []);
    const lines = reportLines(delegation, nameOf, (subtask) => messageOf(subtask.resultMessageId)?.content ?? null);
    deps.enqueue(reportJob(delegation, plan, results, lines));
  }

  function settle(delegationId: string, subtaskId: string, result: SubtaskResult): void {
    const delegation = find(delegationId);
    if (delegation?.status !== 'running') return;
    const next = settleSubtask(delegation, subtaskId, result, now());
    if (!allSettled(next)) return save(next);
    report(next);
  }

  return {
    create(reply, tasks, channel) {
      notice(core, reply, tasks);
      if (reply.delegationId === null || tasks.entries.length === 0) return;
      const delegation = newDelegation(core, reply.delegationId, reply, tasks);
      core.state.delegations.push(delegation);
      core.bus.emit('delegation-changed', delegation);
      const assignees = delegation.subtasks.map((subtask) => subtask.assigneeId);
      const joined = assignees.map((assigneeId) => deps.join(channel, assigneeId, reply.rootId)).some(Boolean);
      if (joined) emitStateChanged(core);
      for (const subtask of delegation.subtasks) deps.enqueue(taskJob(reply, delegation.id, subtask));
    },
    started(job) {
      const delegation =
        job.mode === 'task' && job.delegation?.subtaskId ? find(job.delegation.delegationId) : undefined;
      if (delegation?.status === 'running' && job.delegation?.subtaskId)
        save(startSubtask(delegation, job.delegation.subtaskId, now()));
    },
    finished(job, outcome) {
      if (!job.delegation) return;
      if (job.mode === 'task' && job.delegation.subtaskId)
        return settle(job.delegation.delegationId, job.delegation.subtaskId, outcomeResult(outcome));
      const delegation = find(job.delegation.delegationId);
      if (job.mode !== 'report' || delegation?.status !== 'reporting') return;
      save({
        ...delegation,
        status: 'done',
        summaryMessageId: outcome.type === 'reply' ? outcome.message.id : null,
        updatedAt: now(),
      });
    },
    cancel(matches, note) {
      for (const delegation of core.state.delegations.filter((candidate) => isOpen(candidate) && matches(candidate))) {
        save(cancelDelegation(delegation, note, now()));
      }
    },
    dropAssignee(agentId, channelId) {
      const here = (candidate: Delegation) => channelId === null || candidate.channelId === channelId;
      const running = core.state.delegations.filter((candidate) => candidate.status === 'running' && here(candidate));
      for (const delegation of running) {
        const mine = delegation.subtasks.filter((subtask) => subtask.assigneeId === agentId && isUnsettled(subtask));
        for (const subtask of mine) settle(delegation.id, subtask.id, ASSIGNEE_DROPPED);
      }
    },
  };
}
