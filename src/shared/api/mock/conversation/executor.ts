// 1ジョブの実行（ランナーの代わり）: activity を順に出し（そのあいだに途中の投稿もして）から、返答を投稿する。
// 割り振れるエージェント（canDelegate）の返答に tasks ブロックがあれば、投稿の前に読んで割り振りの id を結ぶ。
import type { Agent, Message, MessageKind } from '@/shared/types/domain';
import { parseTasks } from '../delegation/tasks';
import type { ParsedTasks } from '../delegation/tasks';
import { didNotAnswer, failed } from '../notices';
import { activeAgents, postMessage } from '../runtime';
import type { Cancel, MockCore } from '../runtime';
import { planReply } from './replies';
import type { ReplyPlan } from './replies';
import type { MockJob } from './routing';

/** activity を切り替える間隔（ms） */
export const STEP_MS = 700;

/**
 * - reply: 返答を投稿した（tasks は読んだ tasks ブロック。なければ null）
 * - pass: [PASS] などで投稿しなかった
 * - failed: 失敗してエラー発言を残した
 */
export type JobOutcome =
  | { type: 'reply'; message: Message; tasks: ParsedTasks | null }
  | { type: 'pass'; note: string }
  | { type: 'failed'; note: string; message: Message };

export interface JobCallbacks {
  onActivity: (detail: string) => void;
  onDone: (outcome: JobOutcome) => void;
}

/** 実行できない理由（ランナーが動いていない・バックエンドの準備ができていない）。実行できれば null */
function unavailableReason(core: MockCore, agent: Agent): string | null {
  if (core.state.runtime.state !== 'ready') {
    return 'エージェントの実行環境が起動していません。しばらく待ってから話しかけてください。';
  }
  const backend = core.state.backends.find((candidate) => candidate.id === agent.backend);
  if (!backend) return `バックエンド「${agent.backend}」が見つかりません。`;
  if (backend.status !== 'ready') return `${backend.label} の準備ができていません。${backend.statusMessage}`;
  return null;
}

function post(
  core: MockCore,
  job: MockJob,
  content: string,
  kind: MessageKind,
  delegationId: string | null = null,
): Message {
  return postMessage(core, {
    channelId: job.channelId,
    authorId: job.agentId,
    content,
    kind,
    replyToId: job.triggers.at(-1)?.id ?? null,
    depth: job.depth,
    delegationId,
    ...(job.rootId === null ? {} : { rootId: job.rootId }),
  });
}

function finish(core: MockCore, job: MockJob, agent: Agent, plan: ReplyPlan): JobOutcome {
  if (plan.content.trim() === '[PASS]') return { type: 'pass', note: didNotAnswer(agent.name) };
  const tasks = agent.canDelegate ? parseTasks(plan.content, activeAgents(core), agent.id) : null;
  const delegationId = tasks && tasks.entries.length > 0 ? core.env.newId() : null;
  return { type: 'reply', message: post(core, job, plan.content, plan.kind, delegationId), tasks };
}

/** 途中の投稿（kind=progress。振り分けない）を、最後の返答より前に順に出す */
function scheduleProgress(core: MockCore, job: MockJob, plan: ReplyPlan | null, finishAt: number): Cancel[] {
  return (plan?.progress ?? []).map((content, index) =>
    core.env.schedule(Math.min(STEP_MS * (index + 1.5), finishAt - 1), () => {
      post(core, job, content, 'progress');
    }),
  );
}

function membersOf(core: MockCore, channelId: string): Agent[] {
  const channel = core.state.channels.find((candidate) => candidate.id === channelId);
  return activeAgents(core).filter((agent) => channel?.memberIds.includes(agent.id));
}

/** ジョブを始める。戻り値で中断できる（中断したら投稿も振り分けもしない） */
export function runJob(core: MockCore, job: MockJob, agent: Agent, callbacks: JobCallbacks): Cancel {
  const reason = unavailableReason(core, agent);
  const plan =
    reason === null
      ? planReply({
          job,
          agent,
          agents: activeAgents(core),
          members: membersOf(core, job.channelId),
          skills: core.state.skills,
        })
      : null;
  const details = plan?.steps ?? ['考え中…'];
  const cancels = details.map((detail, index) =>
    core.env.schedule(index * STEP_MS, () => callbacks.onActivity(detail)),
  );
  cancels.push(...scheduleProgress(core, job, plan, details.length * STEP_MS));
  cancels.push(
    core.env.schedule(details.length * STEP_MS, () => {
      if (plan) {
        callbacks.onDone(finish(core, job, agent, plan));
        return;
      }
      const message = post(core, job, reason ?? '', 'error');
      callbacks.onDone({ type: 'failed', note: failed(agent.name), message });
    }),
  );
  return () => cancels.forEach((cancel) => cancel());
}
