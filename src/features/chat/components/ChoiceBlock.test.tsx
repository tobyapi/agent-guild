// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyLanguage } from '@/shared/i18n';
import { HUMAN_ID } from '@/shared/types/domain';
import type { Message } from '@/shared/types/domain';
import { useChoiceStore } from '../choiceStore';
import type { AuthorView } from '../model/authors';
import type { ChoiceGate } from '../model/choiceRead';
import { fence, message, PROMPT_SAMPLE, proposal, SAMPLE_LABELS } from '../model/choiceFixtures.test-support';
import { MessageItem } from './MessageItem';

const sending = vi.hoisted(() => ({ sendChoice: vi.fn() }));
vi.mock('@/features/frames', () => ({ MemberAvatar: () => null }));
vi.mock('@/features/agents', () => ({ TagBadge: () => null, getAllAgents: () => [] }));
vi.mock('@/features/channels', () => ({ useChannelsStore: { getState: () => ({ channels: [] }) } }));
vi.mock('@/features/runtime', () => ({ BackendTag: () => null }));
vi.mock('./MessageBody', () => ({ MessageBody: ({ content }: { content: string }) => <pre>{content}</pre> }));
vi.mock('./MessageAttachments', () => ({ MessageAttachments: () => null }));
vi.mock('./TaskCard', () => ({ TaskCard: () => null }));
vi.mock('../choiceStore', async (original) => ({ ...(await original<object>()), ...sending }));

const author: AuthorView = {
  name: '白竜2',
  avatar: '',
  color: '',
  frame: '',
  tag: null,
  backend: null,
  human: false,
  deleted: false,
};

function show(item: Message, gate: ChoiceGate = 'open', human = false) {
  return render(
    <MessageItem
      message={item}
      author={{ ...author, human }}
      head={false}
      live={false}
      mentionsMe={false}
      renderBody={(text) => text}
      delegation={undefined}
      taskLink={undefined}
      highlight={undefined}
      choiceGate={gate}
    />,
  );
}

const buttons = () => SAMPLE_LABELS.map((label) => screen.getByRole<HTMLButtonElement>('button', { name: label }));

beforeEach(() => applyLanguage('ja'));
afterEach(() => {
  cleanup();
  sending.sendChoice.mockReset();
  useChoiceStore.setState({ sending: {} });
});

it('shows the prompt sample as three native buttons in a group and hides the JSON', () => {
  const view = show(message({ id: 'p' }));
  expect(screen.getByRole('group', { name: '選択肢' })).toBeDefined();
  expect(buttons().map((button) => button.type)).toEqual(['button', 'button', 'button']);
  expect(view.container.textContent).not.toContain('createSurface');
  expect(view.container.querySelector('pre')?.textContent).toBe('どこまで進める？');
  fireEvent.click(buttons()[1]!);
  expect(sending.sendChoice).toHaveBeenCalledWith({
    channelId: 'c',
    messageId: 'p',
    authorId: 'agent-a',
    label: SAMPLE_LABELS[1],
    index: 1,
  });
});

it.each([
  ['closed', '新しい発言があるため'],
  ['deleted', '削除されたため'],
  ['outside', 'いないため'],
] as const)('keeps %s choices visible but disabled with the reason', (gate, reason) => {
  show(message(), gate);
  expect(buttons().every((button) => button.disabled)).toBe(true);
  expect(screen.getByText(new RegExp(reason))).toBeDefined();
  fireEvent.click(buttons()[0]!);
  expect(sending.sendChoice).not.toHaveBeenCalled();
});

it('disables the buttons while a choice in the channel is being sent', () => {
  useChoiceStore.setState({ sending: { c: true } });
  show(message());
  expect(buttons().every((button) => button.disabled)).toBe(true);
  expect(screen.getByText('選択を送信しています…')).toBeDefined();
});

it('shows readable labels without buttons when the JSON is broken', () => {
  const cut = PROMPT_SAMPLE.slice(0, PROMPT_SAMPLE.indexOf('{"t":"C.'));
  const view = show(message({ content: proposal(cut) }));
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(screen.getByText('一部の選択肢を読み取れません。選択肢をもう一度聞いてください')).toBeDefined();
  expect([...view.container.querySelectorAll('li')].map((li) => li.textContent)).toEqual(SAMPLE_LABELS.slice(0, 2));
  expect(view.container.querySelector('details')?.open).toBe(false);
  expect(view.container.querySelector('details pre')?.textContent).toBe(cut);
});

it('shows only a notice and keeps the body for two blocks', () => {
  const content = proposal(PROMPT_SAMPLE, fence(PROMPT_SAMPLE));
  const view = show(message({ content }));
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(screen.getByText('選択肢を読み取れません。ボタンからは送れません')).toBeDefined();
  expect(view.container.querySelector('pre')?.textContent).toBe(content);
});

it('shows labels with markup as plain text only', () => {
  const json = PROMPT_SAMPLE.replace('A. 調査だけ進める', 'A. <img src=x onerror=alert(1)>');
  const view = show(message({ content: proposal(json) }));
  expect(screen.getByText('A. <img src=x onerror=alert(1)>')).toBeDefined();
  expect(view.container.querySelector('img')).toBeNull();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});

it('leaves a human code example and progress posts as plain text', () => {
  show(message({ authorId: HUMAN_ID }), 'open', true);
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  cleanup();
  const view = show(message({ kind: 'progress' }));
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(view.container.textContent).toContain('createSurface');
});

it('keeps skill usage labels next to the buttons (notify and skill-usage are stripped before saving)', () => {
  const skillUsage = { declared: ['clean-code'], loaded: [], supported: false, runId: 'r' };
  const view = show(message({ skillUsage }));
  expect(buttons()).toHaveLength(3);
  expect(view.container.querySelector('details summary')?.textContent).toBe('スキルの記録');
});
