// 発言の一覧（seq のカーソルでページング）・送信・停止と、割り振りの一覧。
import { DELEGATION_LIST_MAX, MESSAGE_PAGE_MAX, MESSAGE_PAGE_SIZE } from '@/shared/lib/limits';
import { HUMAN_ID } from '@/shared/types/domain';
import { attachmentData, storeAttachments } from '../attachments';
import { fail, postMessage, requireChannel } from '../runtime';
import type { HandlerGroup } from './types';

type MessageCommands =
  'list_messages' | 'send_message' | 'get_attachment' | 'reveal_attachment' | 'stop_channel' | 'list_delegations';

export const messageHandlers: HandlerGroup<MessageCommands> = {
  /** beforeSeq より前の発言を新しいほうから limit 件、seq の昇順で返す */
  list_messages({ channelId, beforeSeq, limit }, runtime) {
    requireChannel(runtime, channelId);
    const size = Math.min(Math.max(limit ?? MESSAGE_PAGE_SIZE, 1), MESSAGE_PAGE_MAX);
    const older = runtime.state.messages.filter(
      (message) => message.channelId === channelId && (beforeSeq === null || message.seq < beforeSeq),
    );
    return older.slice(-size);
  },

  /** 画像・ファイルだけの発言は本文が空でよい */
  send_message({ channelId, content, attachments }, runtime) {
    const channel = requireChannel(runtime, channelId);
    const text = content.trim();
    if (text === '' && attachments.length === 0) fail('validation', 'メッセージを入力してください', 'content');
    const stored = storeAttachments(runtime, attachments);
    const draft = { channelId, authorId: HUMAN_ID, content: text, attachments: stored, kind: 'chat' as const };
    const message = postMessage(runtime, draft);
    runtime.conversation.onHumanMessage(message, channel);
    return message;
  },

  get_attachment: ({ messageId, attachmentId }, runtime) => attachmentData(runtime, messageId, attachmentId),

  /** ブラウザにはファイラがないので、添付があるかを確かめるだけ */
  reveal_attachment({ messageId, attachmentId }, runtime) {
    attachmentData(runtime, messageId, attachmentId);
    return null;
  },

  stop_channel({ channelId }, runtime) {
    requireChannel(runtime, channelId);
    runtime.conversation.stop(channelId);
    return null;
  },

  /** createdAt の昇順、新しい方から DELEGATION_LIST_MAX 件 */
  list_delegations({ channelId }, runtime) {
    requireChannel(runtime, channelId);
    return runtime.state.delegations
      .filter((delegation) => delegation.channelId === channelId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-DELEGATION_LIST_MAX);
  },
};
