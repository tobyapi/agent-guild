// @vitest-environment jsdom
// 選択肢ボタンのつなぎ目: MessageList が findActiveProposal / findAnswers / choiceGate を MessageItem へ渡す流れ
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyLanguage } from '@/shared/i18n';
import { HUMAN_ID } from '@/shared/types/domain';
import type { Channel, Message } from '@/shared/types/domain';
import { useChoiceStore } from '../choiceStore';
import type { AuthorView } from '../model/authors';
import { messageElementId } from '../jump';
import {
  fence,
  humanMessage,
  message,
  PROMPT_SAMPLE,
  proposal,
  SAMPLE_LABELS,
} from '../model/choiceFixtures.test-support';
import { MessageList } from './MessageList';

const log = vi.hoisted(() => ({ messages: [] as Message[] }));
vi.mock('@/features/frames', () => ({ MemberAvatar: () => null }));
vi.mock('@/features/agents', () => ({ TagBadge: () => null, getAllAgents: () => [] }));
vi.mock('@/features/channels', () => ({ useChannelsStore: { getState: () => ({ channels: [] }) } }));
vi.mock('@/features/runtime', () => ({ BackendTag: () => null }));
vi.mock('@/features/profile', () => ({ useProfile: () => ({ name: 'あなた' }) }));
vi.mock('./MessageBody', () => ({ MessageBody: ({ content }: { content: string }) => <pre>{content}</pre> }));
vi.mock('./MessageAttachments', () => ({ MessageAttachments: () => null }));
vi.mock('./TaskCard', () => ({ TaskCard: () => null }));
vi.mock('../hooks/useChannelLog', () => ({
  useChannelLog: () => ({
    messages: log.messages,
    hasMore: false,
    ready: true,
    loadingOlder: false,
    liveAfterSeq: Number.MAX_SAFE_INTEGER,
    requestOlder: () => {},
  }),
}));
vi.mock('../hooks/useChannelDelegations', () => ({
  useChannelDelegations: () => ({ byId: {}, links: new Map() }),
}));
vi.mock('../hooks/useMessageScroll', () => ({
  useMessageScroll: () => ({ onScroll: () => {}, requestOlder: () => {}, showJump: false, jumpToBottom: () => {} }),
}));
vi.mock('../hooks/useMessageRenderer', () => ({ useMessageRenderer: () => (text: string) => text }));
vi.mock('../hooks/useToday', () => ({ useToday: () => 0 }));
vi.mock('../hooks/useAuthorResolver', () => {
  const view = (id: string): AuthorView => ({
    name: id === 'agent-gone' ? '削除済み' : '白竜2',
    avatar: '',
    color: '',
    frame: '',
    tag: null,
    backend: null,
    human: id === HUMAN_ID,
    deleted: id === 'agent-gone',
  });
  return { useAuthorResolver: () => view, useKnownNames: () => [] };
});

const channel = { id: 'c', name: '開発', topic: '', memberIds: [HUMAN_ID, 'agent-a', 'agent-gone'] } as Channel;

/** 発言ごとの3つのボタン（発言の article の中） */
function buttonsOf(item: Message): HTMLButtonElement[] {
  const article = document.getElementById(messageElementId(item.id));
  if (!article) throw new Error(`no message ${item.id}`);
  return within(article).getAllByRole<HTMLButtonElement>('button');
}

function show(messages: Message[]) {
  log.messages = messages;
  return render(<MessageList channel={channel} />);
}

const enabled = (item: Message) => buttonsOf(item).filter((button) => !button.disabled).length;

beforeEach(() => applyLanguage('ja'));
afterEach(() => {
  cleanup();
  useChoiceStore.setState({ sending: {} });
});

it('makes only the newest of two proposals clickable', () => {
  const old = message();
  const latest = message();
  show([old, latest]);
  expect(enabled(old)).toBe(0);
  expect(enabled(latest)).toBe(3);
});

it('closes every proposal after a human message and marks the sent choice as answered', () => {
  const first = message();
  const second = message();
  show([first, humanMessage(`@白竜2 ${SAMPLE_LABELS[2]}`), second, humanMessage('別の答え')]);
  expect(enabled(first) + enabled(second)).toBe(0);
  const picked = buttonsOf(first).map((button) => button.getAttribute('aria-pressed'));
  expect(picked).toEqual(['false', 'false', 'true']);
  expect(buttonsOf(first)[2]?.textContent).toContain('✓');
  expect(buttonsOf(second).some((button) => button.getAttribute('aria-pressed') === 'true')).toBe(false);
  expect(screen.getAllByText('回答済み')).toHaveLength(2);
  expect(screen.queryByText(/新しい発言があるため/)).toBeNull();
});

it('does not leave the older proposal clickable when the newest one is broken', () => {
  const old = message();
  const broken = message({ content: proposal('{oops') });
  show([old, broken]);
  expect(enabled(old)).toBe(0);
  expect(screen.getByText(/新しい発言があるため/)).toBeDefined();
});

it('reads a proposal that also has a tasks block', () => {
  const tasks = ['```tasks', '@白竜: 調べて', '```'].join('\n');
  const both = message({
    delegationId: 'd',
    content: ['どこまで進める？', '', tasks, '', fence(PROMPT_SAMPLE)].join('\n'),
  });
  show([both]);
  expect(enabled(both)).toBe(3);
  expect(document.body.textContent).not.toContain('createSurface');
});

it('disables the newest proposal when its author was deleted', () => {
  const gone = message({ authorId: 'agent-gone' });
  show([message(), gone]);
  expect(screen.queryAllByRole('button').filter((button) => !(button as HTMLButtonElement).disabled)).toHaveLength(0);
  expect(screen.getByText(/削除されたため/)).toBeDefined();
});

it('wraps long labels with a class only on the choice buttons', () => {
  show([message()]);
  const button = screen.getByRole('button', { name: SAMPLE_LABELS[0] });
  expect(button.className).toMatch(/choice/);
});
