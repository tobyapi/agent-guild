// モックの割り振りまわりの返答: マネージャーの割り振り（tasks ブロック）・担当者の報告・マネージャーのまとめ。
// 振る舞いは本人の設定（canDelegate）とジョブのモードだけで決め、テンプレートやタグでは分けない。
import type { Agent } from '@/shared/types/domain';
import type { ReplyContext, ReplyPlan } from './replies';

const MOCK_NOTE = '（ブラウザ用のモックの返答です）';
/** 一度に割り振る相手の数（モックの決め方） */
const MAX_ASSIGNEES = 3;

const INSTRUCTIONS: ReadonlyArray<(topic: string) => string> = [
  (topic) => `「${topic}」について調べて、要点を3つにまとめてください`,
  (topic) => `「${topic}」の進め方を考えて、手順を箇条書きにしてください`,
  (topic) => `「${topic}」で気をつけることを、想定される反対意見と一緒に挙げてください`,
];

const instructionFor = (index: number, topic: string) => INSTRUCTIONS[index % INSTRUCTIONS.length]?.(topic) ?? topic;
const isCasual = (agent: Agent) => agent.tone.includes('常体');
const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

/** マネージャーの返答: チャンネルの（割り振る側でない）メンバーに tasks ブロックで割り振る */
export function managerPlan(ctx: ReplyContext, topic: string): ReplyPlan {
  const assignees = ctx.members
    .filter((agent) => agent.id !== ctx.agent.id && !agent.canDelegate)
    .slice(0, MAX_ASSIGNEES);
  if (assignees.length === 0) {
    const content = 'このチャンネルには割り振れる相手がいません。メンバーを追加してから、もう一度頼んでください。';
    return { steps: ['考え中…', '書いています…'], content, kind: 'chat' };
  }
  const lines = assignees.map((agent, index) => `@${agent.name}: ${instructionFor(index, topic)}`);
  const content = [
    `「${topic}」は${assignees.length}つに分けて進めます。`,
    '',
    '```tasks',
    ...lines,
    '```',
    '',
    'そろったらまとめて報告します。',
  ].join('\n');
  return { steps: ['考え中…', '段取りを考えています…', '書いています…'], content, kind: 'chat' };
}

/** 担当者の報告。人によって作業の長さを変えて、報告が少しずつずれて届くようにする */
export function taskPlan(ctx: ReplyContext): ReplyPlan {
  const instruction = ctx.job.notes[0] ?? 'この件';
  const extra =
    Math.max(
      ctx.agents.findIndex((agent) => agent.id === ctx.agent.id),
      0,
    ) % 3;
  const steps = [
    '考え中…',
    `作業中: ${shorten(instruction, 24)}`,
    ...Array<string>(extra).fill('確かめています…'),
    '書いています…',
  ];
  const lead = `${shorten(instruction, 28)} — ${isCasual(ctx.agent) ? '終わった。' : '終わりました！'}`;
  const content = [
    lead,
    '',
    '- 目的と制約を先に確かめました',
    '- 進め方の案を2つに絞りました',
    '- 詳しくは作業フォルダのメモにあります',
    '',
    MOCK_NOTE,
  ].join('\n');
  const progress = isCasual(ctx.agent)
    ? '進捗: 目的と制約は確かめた。案を絞っている。'
    : '進捗: 目的と制約を確かめました。いまは案を絞っています。';
  return { steps, content, kind: 'chat', progress: [progress] };
}

/** マネージャーのまとめ。ジョブの注記（担当者｜指示｜状態｜結果か理由）を1人1行にする */
export function reportPlan(ctx: ReplyContext): ReplyPlan {
  const lines = ctx.job.notes.map((note) => {
    const [name = '', , status = '', result = ''] = note.split('｜');
    const firstLine = result.split('\n').find((line) => line.trim() !== '') ?? '';
    return `- **${name}**（${status}）: ${shorten(firstLine.trim(), 40) || '内容なし'}`;
  });
  const content = [
    '全員の結果がそろったのでまとめます。',
    '',
    ...lines,
    '',
    '次の一手: 足りないところがあれば、もう一度割り振ります。',
  ].join('\n');
  return { steps: ['考え中…', '結果を読んでいます…', '書いています…'], content, kind: 'chat' };
}
