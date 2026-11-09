// モックのエージェントの返答。LLM の代わりに、本人の設定（相談相手になるか・割り振れるか）・口調・きっかけに応じた定型文を返す。
import { HUMAN_ID } from '@/shared/types/domain';
import type { Agent, Message, MessageKind, Skill } from '@/shared/types/domain';
import { managerPlan, reportPlan, taskPlan } from './delegationReplies';
import type { MockJob } from './routing';

export interface ReplyPlan {
  /** 途中経過（activity の detail）。順に表示してから投稿する */
  steps: string[];
  content: string;
  kind: MessageKind;
  /** 作業の途中の投稿（kind=progress）。途中経過のあいだに順に投稿する */
  progress?: string[];
}

export interface ReplyContext {
  job: MockJob;
  agent: Agent;
  /** 削除されていないエージェント */
  agents: readonly Agent[];
  /** このチャンネルのメンバー（削除されていないエージェント） */
  members: readonly Agent[];
  skills: readonly Skill[];
}

const MOCK_NOTE = '（ブラウザ用のモックの返答です）';

/** 発言からメンションを除いた要約（24文字まで） */
export function topicOf(trigger: Message | undefined): string {
  const text = (trigger?.content ?? '').replace(/[@＠]\S+/g, '').replace(/\s+/g, ' ').trim();
  if (text === '') return 'この件';
  return text.length > 24 ? `${text.slice(0, 24)}…` : text;
}

const isCasual = (agent: Agent) => agent.tone.includes('常体');

/** 人間に名指しでレビューを頼まれたら、相談相手になる設定のエージェントに回す */
function reviewerFor(ctx: ReplyContext, trigger: Message | undefined): Agent | null {
  if (!trigger || trigger.authorId !== HUMAN_ID || !trigger.content.includes('レビュー')) return null;
  if (!trigger.mentions.includes(ctx.agent.id)) return null;
  return ctx.agents.find((agent) => agent.id !== ctx.agent.id && agent.consultable) ?? null;
}

function workerReply(agent: Agent, topic: string): string {
  if (isCasual(agent)) {
    return [`確認した。「${topic}」の要点:`, '', '- 先に目的と制約を決める', '- 小さく作って検証する', '', MOCK_NOTE].join('\n');
  }
  return [
    `了解です！「${topic}」について調べてみました。`,
    '',
    '1. **まず押さえたいこと**: 目的と制約を先に決めると迷いません',
    '2. **よくある落とし穴**: 範囲を広げすぎること',
    '3. **次の一手**: 小さく試して結果を共有します',
    '',
    MOCK_NOTE,
  ].join('\n');
}

function askReview(agent: Agent, reviewer: Agent, topic: string): string {
  const lead = isCasual(agent) ? '下書きを作った。' : '下書きを作りました！';
  return [`${lead} @${reviewer.name} 論点に抜けがないかレビューをお願いします。`, '', `> ${topic}`].join('\n');
}

function consultantReply(topic: string): string {
  return [
    '⚠️ 要修正',
    '',
    `「${topic}」について:`,
    '1. **根拠が足りません**: 主張を支えるデータを1つ添えてください。',
    '2. **前提が暗黙です**: 誰に向けた提案かを最初に書きましょう。',
    '',
    '次の一手: 上の2点を直せば ✅ にできます。',
  ].join('\n');
}

function returnReply(agent: Agent, notes: readonly string[]): string {
  if (notes.length > 0) return `${notes.join('、')}。このまま進めます。`;
  return isCasual(agent) ? '指摘を反映した。' : '指摘ありがとうございます！反映して進めますね。';
}

function autonomousReply(agent: Agent): string {
  const role = agent.role || '自分の担当';
  return isCasual(agent)
    ? `空き時間に「${role}」まわりを調べた。メモを作業フォルダに置いておく。`
    : `自由時間に「${role}」まわりを調べてみました。気になった点をメモして作業フォルダに置いておきますね。`;
}

function steps(ctx: ReplyContext, topic: string): string[] {
  if (!ctx.agent.consultable) {
    return ['考え中…', `Web検索: ${topic}`, 'ページを読んでいます: https://example.com/', '書いています…'];
  }
  const skill = ctx.skills.find((candidate) => candidate.agentId === ctx.agent.id);
  return ['考え中…', skill ? `スキルを参照: ${skill.name}` : 'ファイルを読んでいます…', '書いています…'];
}

function content(ctx: ReplyContext, trigger: Message | undefined, topic: string): string {
  if (ctx.job.mode === 'return') return returnReply(ctx.agent, ctx.job.notes);
  if (ctx.agent.consultable) return consultantReply(topic);
  const reviewer = reviewerFor(ctx, trigger);
  return reviewer ? askReview(ctx.agent, reviewer, topic) : workerReply(ctx.agent, topic);
}

export function planReply(ctx: ReplyContext): ReplyPlan {
  if (ctx.job.mode === 'autonomous') {
    const detail = `Web検索: ${ctx.agent.role || '最近の話題'}`;
    return { steps: ['考え中…', detail, '書いています…'], content: autonomousReply(ctx.agent), kind: 'autonomous' };
  }
  if (ctx.job.mode === 'task') return taskPlan(ctx);
  if (ctx.job.mode === 'report') return reportPlan(ctx);
  const trigger = ctx.job.triggers.at(-1);
  const topic = topicOf(trigger);
  if (ctx.job.mode === 'reply' && ctx.agent.canDelegate) return managerPlan(ctx, topic);
  return { steps: steps(ctx, topic), content: content(ctx, trigger, topic), kind: 'chat' };
}
