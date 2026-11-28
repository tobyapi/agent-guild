import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyLanguage } from '@/shared/i18n';
import { HUMAN_ID } from '@/shared/types/domain';
import type { Agent, Channel, Message } from '@/shared/types/domain';
import { chatApi } from './api';
import { sendChoice, useChoiceStore, type ChoiceRequest } from './choiceStore';
import { humanMessage, message, SAMPLE_LABELS } from './model/choiceFixtures.test-support';
import { useChatStore } from './store';

const agents = vi.hoisted(() => ({ list: [] as Agent[] }));
const channels = vi.hoisted(() => ({ list: [] as Channel[] }));
const toast = vi.hoisted(() => ({ notifyError: vi.fn() }));
vi.mock('@/features/agents', () => ({ getAllAgents: () => agents.list }));
vi.mock('@/features/channels', () => ({ useChannelsStore: { getState: () => ({ channels: channels.list }) } }));
vi.mock('@/shared/ui', () => toast);

const agent = { id: 'agent-a', name: '白竜2', deletedAt: null } as Agent;
const channel = { id: 'c', name: '開発', memberIds: [HUMAN_ID, 'agent-a'] } as Channel;
const proposalMessage = message({ id: 'p' });
const request = (index = 1): ChoiceRequest => ({
  channelId: 'c',
  messageId: 'p',
  authorId: 'agent-a',
  label: SAMPLE_LABELS[index] ?? '',
  index,
});

function setLog(messages: Message[]) {
  useChatStore.setState({
    logs: { c: { messages, hasMore: false, status: 'ready', loadingOlder: false, liveAfterSeq: 0 } },
  });
}

function deferredSend() {
  let resolve: (value: Message) => void = () => {};
  const send = vi.spyOn(chatApi, 'send').mockImplementation(
    () =>
      new Promise<Message>((done) => {
        resolve = done;
      }),
  );
  return { send, resolve: (value: Message) => resolve(value) };
}

beforeEach(() => {
  applyLanguage('ja');
  agents.list = [agent];
  channels.list = [channel];
  setLog([proposalMessage]);
});

afterEach(() => {
  vi.restoreAllMocks();
  toast.notifyError.mockReset();
  useChoiceStore.setState({ sending: {} });
  useChatStore.setState({ logs: {} });
});

it('sends "@current name label" once even when pressed repeatedly or another choice is pressed', async () => {
  const { send, resolve } = deferredSend();
  const first = sendChoice(request(1));
  expect(useChoiceStore.getState().sending.c).toBe(true);
  expect(await sendChoice(request(1))).toBe(false);
  expect(await sendChoice(request(0))).toBe(false);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith('c', '@白竜2 B. 設計案まで作る', []);
  const sent = humanMessage('@白竜2 B. 設計案まで作る');
  resolve(sent);
  expect(await first).toBe(true);
  expect(useChoiceStore.getState().sending.c).toBeUndefined();
  expect(useChatStore.getState().logs.c?.messages.at(-1)).toBe(sent);
  expect(await sendChoice(request(2))).toBe(false);
  expect(send).toHaveBeenCalledTimes(1);
});

it('uses the renamed name at the time of the click', async () => {
  agents.list = [{ ...agent, name: '白竜3' }];
  const send = vi.spyOn(chatApi, 'send').mockResolvedValue(humanMessage('@白竜3 A. 調査だけ進める'));
  await sendChoice(request(0));
  expect(send).toHaveBeenCalledWith('c', '@白竜3 A. 調査だけ進める', []);
});

it('keeps other channels independent while one is sending', () => {
  const { send } = deferredSend();
  channels.list = [channel, { ...channel, id: 'd' }];
  const other = message({ id: 'q', channelId: 'd' });
  const log = useChatStore.getState().logs.c!;
  useChatStore.setState({ logs: { c: log, d: { ...log, messages: [other] } } });
  void sendChoice(request(1));
  void sendChoice({ ...request(0), channelId: 'd', messageId: 'q' });
  expect(useChoiceStore.getState().sending).toEqual({ c: true, d: true });
  expect(send).toHaveBeenCalledTimes(2);
});

it('shows an error without a resend action and allows pressing again after a failure', async () => {
  vi.spyOn(chatApi, 'send').mockRejectedValue({ code: 'validation', message: '長すぎます' });
  expect(await sendChoice(request(1))).toBe(false);
  expect(toast.notifyError).toHaveBeenCalledWith('選択を送れませんでした（長すぎます）。もう一度押してください。');
  expect(toast.notifyError.mock.calls[0]).toHaveLength(1);
  expect(useChoiceStore.getState().sending.c).toBeUndefined();
});

it.each([
  ['deleted', () => void (agents.list = [{ ...agent, deletedAt: 1 }]), '削除されたため'],
  ['unknown', () => void (agents.list = []), '削除されたため'],
  ['outside the channel', () => void (channels.list = [{ ...channel, memberIds: [HUMAN_ID] }]), 'いないため'],
  ['answered', () => setLog([proposalMessage, humanMessage()]), '新しい発言があるため'],
  ['superseded', () => setLog([proposalMessage, message({ id: 'newer' })]), '新しい発言があるため'],
])('does not send when the proposer is %s', async (_name, arrange, reason) => {
  arrange();
  const send = vi.spyOn(chatApi, 'send');
  expect(await sendChoice(request(1))).toBe(false);
  expect(send).not.toHaveBeenCalled();
  expect(String(toast.notifyError.mock.calls[0]?.[0])).toContain(reason);
  expect(useChoiceStore.getState().sending.c).toBeUndefined();
});

it('rejects a label with a mention even if it reaches the sender', async () => {
  const send = vi.spyOn(chatApi, 'send');
  expect(await sendChoice({ ...request(1), label: 'B. ＠Claude に頼む' })).toBe(false);
  expect(send).not.toHaveBeenCalled();
});
