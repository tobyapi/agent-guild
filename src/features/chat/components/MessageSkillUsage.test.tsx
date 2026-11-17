// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Message } from '@/shared/types/domain';
import { MessageItem } from './MessageItem';
import type { AuthorView } from '../model/authors';

vi.mock('@/features/frames', () => ({ MemberAvatar: () => null }));
vi.mock('@/features/agents', () => ({ TagBadge: () => null }));
vi.mock('@/features/runtime', () => ({ BackendTag: () => null }));
vi.mock('./MessageBody', () => ({ MessageBody: ({ content }: { content: string }) => <div>{content}</div> }));
vi.mock('./MessageAttachments', () => ({ MessageAttachments: () => null }));
vi.mock('./TaskCard', () => ({ TaskCard: () => null }));

afterEach(cleanup);
const content = '検証しました。\n```skill-usage\n["clean-code","reflection"]\n```';
const author: AuthorView = {
  name: 'Agent',
  avatar: '',
  color: '',
  frame: '',
  tag: null,
  backend: null,
  human: false,
  deleted: false,
};
const message: Message = {
  id: 'one',
  seq: 1,
  channelId: 'c',
  authorId: 'a',
  content: '検証しました。',
  skillUsage: { declared: ['clean-code', 'reflection'], loaded: [], supported: false, runId: 'run-a' },
  attachments: [],
  kind: 'chat',
  mentions: [],
  replyToId: null,
  rootId: 'one',
  depth: 1,
  delegationId: null,
  createdAt: 1,
};
function show(overrides: Partial<Message> = {}, human = false) {
  return render(
    <MessageItem
      message={{ ...message, ...overrides }}
      author={{ ...author, human }}
      head={false}
      live={false}
      mentionsMe={false}
      renderBody={(text) => text}
      delegation={undefined}
      taskLink={undefined}
      highlight={undefined}
    />,
  );
}

it.each(['chat', 'progress', 'autonomous'] as const)('再読込した%sの投稿に申告を表示する', (kind) => {
  const stored = JSON.parse(JSON.stringify({ ...message, kind })) as Message;
  const view = show(stored);
  const details = view.container.querySelector('details')!;
  const summary = details.querySelector('summary')!;
  expect(details.open).toBe(false);
  expect(summary.textContent).toBe('スキルの記録');
  expect(summary.textContent).not.toContain('clean-code');
  expect(summary.textContent).not.toContain('reflection');
  fireEvent.click(summary);
  expect(details.open).toBe(true);
  expect(screen.getByText('clean-code').parentElement?.textContent).toBe('使用スキル：clean-code');
  expect(screen.getByText('reflection').parentElement?.textContent).toBe('使用スキル：reflection');
  expect(view.container.textContent).not.toContain('skill-usage');
});

it('人間のコード例をエージェントの使用申告として表示しない', () => {
  const view = show({ content }, true);
  expect(view.container.querySelector('details')).toBeNull();
  expect(view.container.textContent).toContain('skill-usage');
});

it('別エージェントの記録なしの投稿へ申告を持ち越さない', () => {
  const first = show();
  expect(screen.getByText('clean-code')).toBeTruthy();
  first.unmount();
  const next = show({ id: 'two', authorId: 'b', content: '古い投稿', skillUsage: null });
  expect(next.container.querySelector('details')).toBeNull();
});

it.each(['system', 'error'] as const)('%sは本文にフッタがあっても申告表示しない', (kind) => {
  const view = show({ kind, content });
  expect(view.container.querySelector('details')).toBeNull();
  expect(view.container.textContent).toContain('skill-usage');
});

it.each([
  content
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n'),
  `\`\`\`\`text\n${content}\n\`\`\`\``,
  content.replace('skill-usage\n', 'skill-usage \n'),
])('エージェントによる引用・コード例・空白付き指定を申告表示しない', (quoted) => {
  const view = show({ content: quoted, skillUsage: null });
  expect(view.container.querySelector('details')).toBeNull();
  expect(view.container.textContent).toContain('skill-usage');
});

it.each(['chat', 'progress', 'autonomous'] as const)('%sの空の記録は欄ごと隠す', (kind) => {
  const view = show({ kind, skillUsage: { declared: [], loaded: [], supported: false, runId: 'r' } });
  expect(view.container.querySelector('details')).toBeNull();
  expect(view.container.textContent).toContain('検証しました。');
});
it('読込記録だけの投稿も表示する', () => {
  const view = show({ skillUsage: { declared: [], loaded: ['reflection'], supported: true, runId: 'r' } });
  expect(view.container.querySelector('summary')?.textContent).toBe('スキルの記録投稿前操作（読込確認）：reflection');
});
