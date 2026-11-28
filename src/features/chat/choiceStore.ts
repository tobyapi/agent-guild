// 選択肢ボタン（a2ui ブロック）を押したときの送信。チャンネルごとの送信中フラグで連打・A のあとの B・画面の切り替えを止める。
// 送るのは既存の send_message。失敗したら保存されていないので（再送トーストは付けず）フラグを下ろしてまた押せるようにする。
import { create } from 'zustand';
import { getAllAgents } from '@/features/agents';
import { useChannelsStore } from '@/features/channels';
import { errorMessage } from '@/shared/lib/errors';
import { notifyError } from '@/shared/ui';
import type { Message } from '@/shared/types/domain';
import { chatApi } from './api';
import { labelProblem } from './model/a2uiChoices';
import { findActiveProposal } from './model/choiceRead';
import { receiveMessage, useChatStore } from './store';
import { t } from './i18n';

interface ChoiceStoreState {
  /** 送信中のチャンネル */
  sending: Record<string, true>;
}

export const useChoiceStore = create<ChoiceStoreState>()(() => ({ sending: {} }));

export function useChoiceSending(channelId: string): boolean {
  return useChoiceStore((state) => state.sending[channelId] === true);
}

function setSending(channelId: string, on: boolean): void {
  useChoiceStore.setState((state) => {
    const sending = { ...state.sending };
    if (on) sending[channelId] = true;
    else delete sending[channelId];
    return { sending };
  });
}

export interface ChoiceRequest {
  channelId: string;
  /** 提案の発言 */
  messageId: string;
  /** 提案した AI */
  authorId: string;
  label: string;
  /** 何番目の選択肢か（0 から） */
  index: number;
}

/** 押した時点の状態で確かめて、送る文（@今の名前 ラベル）を作る。送れなければ理由 */
export function choiceContent(request: ChoiceRequest): { content: string } | { problem: string } {
  const messages: readonly Message[] = useChatStore.getState().logs[request.channelId]?.messages ?? [];
  if (findActiveProposal(messages) !== request.messageId) return { problem: t('choiceClosed') };
  const agent = getAllAgents().find((candidate) => candidate.id === request.authorId);
  if (!agent || agent.deletedAt !== null) return { problem: t('choiceDeleted') };
  const channel = useChannelsStore.getState().channels.find((candidate) => candidate.id === request.channelId);
  if (!channel?.memberIds.includes(request.authorId)) return { problem: t('choiceOutside') };
  if (labelProblem(request.label, request.index) !== null) return { problem: t('choiceUnsupported') };
  return { content: `@${agent.name} ${request.label}` };
}

/** 選択を人間の発言として送る。送れたら true（送信中・押せない状態なら送らずに false） */
export async function sendChoice(request: ChoiceRequest): Promise<boolean> {
  if (useChoiceStore.getState().sending[request.channelId]) return false;
  const checked = choiceContent(request);
  if ('problem' in checked) {
    notifyError(checked.problem);
    return false;
  }
  setSending(request.channelId, true);
  let message: Message;
  try {
    message = await chatApi.send(request.channelId, checked.content, []);
  } catch (error) {
    setSending(request.channelId, false);
    notifyError(t('choiceSendFailed', { reason: errorMessage(error) }));
    return false;
  }
  try {
    receiveMessage(message);
  } catch (error) {
    // 送信は済んでいる（保存済み）ので再送はしない。取り込みの失敗は記録だけ残す
    console.warn('The sent choice could not be added to the log', error);
  } finally {
    setSending(request.channelId, false);
  }
  return true;
}
