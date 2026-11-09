// チャンネルごとの発言（開いたチャンネルの分だけ取得し、message-created を id で冪等に足す）。
import { create } from 'zustand';
import { errorCode, errorMessage } from '@/shared/lib/errors';
import { MESSAGE_PAGE_SIZE } from '@/shared/lib/limits';
import { notifyError, reportError } from '@/shared/ui';
import type { Message } from '@/shared/types/domain';
import { chatApi } from './api';
import { primeAttachment } from './attachmentStore';
import { toAttachmentInput, type PendingAttachment } from './model/pendingAttachments';
import { mergeMessages } from './model/messages';

export interface ChannelLog {
  /** seq の昇順 */
  messages: Message[];
  /** さらに古い発言があるか */
  hasMore: boolean;
  status: 'loading' | 'ready' | 'error';
  loadingOlder: boolean;
  /** 最初の読み込みで届いた最後の seq。これより新しい発言はライブで届いたもの（登場の動きをつける） */
  liveAfterSeq: number;
}

interface ChatStoreState {
  logs: Record<string, ChannelLog>;
}

const EMPTY_LOG: ChannelLog = { messages: [], hasMore: false, status: 'loading', loadingOlder: false, liveAfterSeq: 0 };

export const useChatStore = create<ChatStoreState>()(() => ({ logs: {} }));

function patch(channelId: string, update: (log: ChannelLog) => Partial<ChannelLog>): void {
  useChatStore.setState((state) => {
    const log = state.logs[channelId] ?? EMPTY_LOG;
    return { logs: { ...state.logs, [channelId]: { ...log, ...update(log) } } };
  });
}

/** 最新のページを読む（読み込み済みなら何もしない。届いたイベントで最新に保たれている） */
export async function loadLatest(channelId: string): Promise<void> {
  const current = useChatStore.getState().logs[channelId];
  if (current && current.status !== 'error') return;
  patch(channelId, () => ({ status: 'loading' }));
  try {
    const page = await chatApi.list(channelId, null, MESSAGE_PAGE_SIZE);
    patch(channelId, (log) => ({
      messages: mergeMessages(log.messages, page),
      hasMore: page.length === MESSAGE_PAGE_SIZE,
      status: 'ready',
      liveAfterSeq: page.at(-1)?.seq ?? 0,
    }));
  } catch (error) {
    patch(channelId, () => ({ status: 'error' }));
    reportError(error);
  }
}

/** 過去のページを読む（beforeSeq = いま持っているいちばん古い発言） */
export async function loadOlder(channelId: string): Promise<void> {
  const log = useChatStore.getState().logs[channelId];
  const oldest = log?.messages[0];
  if (!log || !oldest || log.loadingOlder || !log.hasMore) return;
  patch(channelId, () => ({ loadingOlder: true }));
  try {
    const page = await chatApi.list(channelId, oldest.seq, MESSAGE_PAGE_SIZE);
    patch(channelId, (current) => ({
      messages: mergeMessages(current.messages, page),
      hasMore: page.length === MESSAGE_PAGE_SIZE,
      loadingOlder: false,
    }));
  } catch (error) {
    patch(channelId, () => ({ loadingOlder: false }));
    reportError(error);
  }
}

/** message-created: 読み込み中か読み込み済みのチャンネルにだけ足す（ほかは開いたときに読む） */
export function receiveMessage(message: Message): void {
  if (!(message.channelId in useChatStore.getState().logs)) return;
  patch(message.channelId, (log) => ({ messages: mergeMessages(log.messages, [message]) }));
}

/** 送信の失敗の伝え方: 理由が分かればそれを、分からなければ「もう一度お試しください」 */
function sendFailureMessage(error: unknown): string {
  const code = errorCode(error);
  if (code === null || code === 'internal') return '送信できませんでした。もう一度お試しください。';
  return `送信できませんでした。${errorMessage(error)}`;
}

/** 送信する（届いた画像の添付には手元のプレビューを当てておく）。失敗したら「再送信」つきで知らせる */
export async function sendMessage(
  channelId: string,
  content: string,
  attachments: readonly PendingAttachment[] = [],
): Promise<boolean> {
  try {
    const message = await chatApi.send(channelId, content, attachments.map(toAttachmentInput));
    message.attachments.forEach((attachment, index) => {
      const preview = attachments[index]?.preview;
      if (preview) primeAttachment(attachment.id, preview);
    });
    receiveMessage(message);
    return true;
  } catch (error) {
    notifyError(sendFailureMessage(error), {
      label: '再送信',
      run: () => void sendMessage(channelId, content, attachments),
    });
    return false;
  }
}
