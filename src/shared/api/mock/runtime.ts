// 偽バックエンドの土台: 環境（時刻・ID・タイマー・再起動）と、ハンドラと会話処理が共有する操作。
import { parseMentions } from '@/shared/lib/mentions';
import { SYSTEM_ID } from '@/shared/types/domain';
import type { Agent, Channel, ErrorCode, Message } from '@/shared/types/domain';
import { ApiError } from '../errors';
import type { MockEventBus } from './bus';
import type { MockState } from './state';

export type Cancel = () => void;

/** テストで差し替えられるように、時刻・ID・タイマー・再起動は外から渡す */
export interface MockEnv {
  now: () => number;
  newId: () => string;
  schedule: (ms: number, task: () => void) => Cancel;
  /** アプリの再起動の代わり（ブラウザではページを読み直す） */
  restart: () => void;
  /** OS のブラウザで開く代わり（ブラウザでは新しいタブ） */
  openUrl: (url: string) => void;
}

export interface MockCore {
  state: MockState;
  bus: MockEventBus;
  env: MockEnv;
}

export function defaultEnv(): MockEnv {
  return {
    now: () => Date.now(),
    newId: () => crypto.randomUUID(),
    schedule(ms, task) {
      const timer = setTimeout(task, ms);
      return () => clearTimeout(timer);
    },
    restart() {
      if (typeof window !== 'undefined') window.location.replace(window.location.pathname);
    },
    openUrl(url) {
      if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
    },
  };
}

/** コマンドを CommandError で失敗させる（Tauri と同じ形で reject される）。field は validation の対象の入力 */
export function fail(code: ErrorCode, message: string, field: string | null = null): never {
  throw new ApiError({ code, message, field });
}

export function activeAgents(core: MockCore): Agent[] {
  return core.state.agents.filter((agent) => agent.deletedAt === null);
}

export function requireAgent(core: MockCore, id: string): Agent {
  return activeAgents(core).find((agent) => agent.id === id) ?? fail('not_found', 'エージェントが見つかりません');
}

export function requireChannel(core: MockCore, id: string): Channel {
  return core.state.channels.find((channel) => channel.id === id) ?? fail('not_found', 'チャンネルが見つかりません');
}

export function emitStateChanged(core: MockCore): void {
  core.bus.emit('state-changed', null);
}

export type MessageDraft = Pick<Message, 'channelId' | 'authorId' | 'content' | 'kind'> &
  Partial<Pick<Message, 'attachments' | 'replyToId' | 'depth' | 'rootId' | 'delegationId'>>;

/** 発言を保存して message-created を流す。seq は通し番号、rootId を省くと自分自身が起点になる */
export function postMessage(core: MockCore, draft: MessageDraft): Message {
  const id = core.env.newId();
  const message: Message = {
    id,
    seq: core.state.nextSeq,
    channelId: draft.channelId,
    authorId: draft.authorId,
    content: draft.content,
    attachments: draft.attachments ?? [],
    kind: draft.kind,
    // 途中の投稿のメンションは記録しない（通知しない）
    mentions:
      draft.kind === 'system' || draft.kind === 'progress' ? [] : parseMentions(draft.content, activeAgents(core)),
    replyToId: draft.replyToId ?? null,
    rootId: draft.rootId ?? id,
    depth: draft.depth ?? 0,
    delegationId: draft.delegationId ?? null,
    createdAt: core.env.now(),
  };
  core.state.nextSeq += 1;
  core.state.messages.push(message);
  core.bus.emit('message-created', message);
  return message;
}

export function postSystem(core: MockCore, channelId: string, content: string, rootId?: string): Message {
  return postMessage(core, { channelId, authorId: SYSTEM_ID, content, kind: 'system', ...(rootId ? { rootId } : {}) });
}

/** チャンネルに参加させ、システム発言で知らせる */
export function joinChannel(core: MockCore, channel: Channel, agent: Agent, rootId?: string): void {
  channel.memberIds.push(agent.id);
  postSystem(core, channel.id, `${agent.name} がチャンネルに参加しました`, rootId);
}
