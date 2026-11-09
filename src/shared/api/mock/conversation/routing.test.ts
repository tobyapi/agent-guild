import { describe, expect, it } from 'vitest';
import { HUMAN_ID } from '@/shared/types/domain';
import type { Message } from '@/shared/types/domain';
import { MOCK_BACKENDS } from '../seedCatalog';
import { createSeedState } from '../seed';
import { SEED_IDS } from '../seedIds';
import { mergeJobs, pushJob } from './lanes';
import { NO_RESPONDER } from '../notices';
import { defaultResponders, routeAgentReply, routeHumanMessage } from './routing';
import type { MockJob, RoutingContext } from './routing';

const state = createSeedState(0, null);
const lobby = state.channels[0]!;
const context = (overrides: Partial<RoutingContext> = {}): RoutingContext => ({
  channel: lobby,
  agents: state.agents,
  backends: MOCK_BACKENDS,
  ...overrides,
});

const message = (overrides: Partial<Message>): Message => ({
  id: 'm1',
  seq: 1,
  channelId: lobby.id,
  authorId: HUMAN_ID,
  content: '',
  attachments: [],
  kind: 'chat',
  mentions: [],
  replyToId: null,
  rootId: 'm1',
  depth: 0,
  delegationId: null,
  createdAt: 0,
  ...overrides,
});

const job = (overrides: Partial<MockJob>): MockJob => ({
  agentId: SEED_IDS.hal,
  channelId: lobby.id,
  mode: 'reply',
  triggers: [],
  returnTo: [],
  depth: 1,
  rootId: 'm1',
  notes: [],
  delegation: null,
  ...overrides,
});

describe('routing', () => {
  it('メンションなし: ready な lead がいれば lead だけが受け、いなければ answer の全員が作成順に答える', () => {
    const ready = MOCK_BACKENDS.map((backend) => ({ ...backend, status: 'ready' as const }));
    const ids = (ctx: RoutingContext) => defaultResponders(ctx).map((agent) => agent.id);
    expect(ids(context({ backends: ready }))).toEqual([SEED_IDS.kaname]);
    // カナメ（codex）の準備ができていなければ、answer の段に下りる
    expect(ids(context())).toEqual([SEED_IDS.hal]);
    const noLead = { ...lobby, memberIds: lobby.memberIds.filter((id) => id !== SEED_IDS.kaname) };
    expect(ids(context({ channel: noLead, backends: ready }))).toEqual([SEED_IDS.hal, SEED_IDS.sora]);
  });

  it('メンションなし: lead も answer もいなければ fallback の全員、ignore は答えない', () => {
    const noAnswer = { ...lobby, memberIds: [HUMAN_ID, SEED_IDS.sora, SEED_IDS.logica] };
    expect(defaultResponders(context({ channel: noAnswer })).map((agent) => agent.id)).toEqual([SEED_IDS.logica]);
    const ignoring = state.agents.map((agent) => ({ ...agent, unmentioned: 'ignore' as const }));
    expect(defaultResponders(context({ agents: ignoring }))).toEqual([]);
  });

  it('答えられる人がいなければシステム発言', () => {
    const empty = { ...lobby, memberIds: [HUMAN_ID] };
    expect(routeHumanMessage(message({}), context({ channel: empty }))).toEqual([
      { type: 'notice', content: NO_RESPONDER },
    ]);
  });

  it('人間がメンションしたチャンネル外の相手は、設定に関係なく参加させる', () => {
    const empty = { ...lobby, memberIds: [HUMAN_ID] };
    const effects = routeHumanMessage(message({ mentions: [SEED_IDS.sora] }), context({ channel: empty }));
    expect(effects.map((effect) => effect.type)).toEqual(['join', 'enqueue']);
  });

  it('エージェントの返答は、メンションの有無にかかわらず呼び出し元へ戻す（メンションは相談にしない）', () => {
    const reply = message({ id: 'r1', authorId: SEED_IDS.logica, mentions: [SEED_IDS.hal], depth: 2 });
    const effects = routeAgentReply(reply, job({ agentId: SEED_IDS.logica, returnTo: [SEED_IDS.hal] }), context());
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: 'enqueue', job: { agentId: SEED_IDS.hal, mode: 'return', depth: 3 } });
  });

  it('チャンネル外の相手への相談: consultable なら参加させて頼み、そうでなければ届かない旨を知らせる', () => {
    const outside = { ...lobby, memberIds: [HUMAN_ID, SEED_IDS.hal] };
    const reply = message({ authorId: SEED_IDS.hal, mentions: [SEED_IDS.sora, SEED_IDS.logica] });
    const effects = routeAgentReply(reply, job({}), context({ channel: outside }));
    expect(effects.slice(0, 2)).toEqual([
      { type: 'notice', content: 'ソラ はこのチャンネルにいないため、メッセージは届きませんでした' },
      { type: 'join', agentId: SEED_IDS.logica },
    ]);
    expect(effects[2]).toMatchObject({ type: 'enqueue', job: { agentId: SEED_IDS.logica, returnTo: [SEED_IDS.hal] } });
    expect(effects).toHaveLength(3);
  });
});

describe('lanes', () => {
  it('同じエージェントの待機ジョブは1件にまとめる', () => {
    const first = job({ mode: 'return', triggers: [message({ id: 'a' })], returnTo: ['x'], depth: 2 });
    const second = job({ mode: 'reply', triggers: [message({ id: 'b' })], returnTo: ['y'], depth: 4 });
    const merged = mergeJobs(first, second);
    expect(merged).toMatchObject({ mode: 'reply', returnTo: ['x', 'y'], depth: 4 });
    expect(merged.triggers.map((trigger) => trigger.id)).toEqual(['a', 'b']);
    expect(pushJob([first], second)).toHaveLength(1);
    expect(pushJob([first], job({ agentId: SEED_IDS.sora }))).toHaveLength(2);
  });
});
