import { invoke } from '@/shared/api';
import type { AttachmentInput } from '@/shared/types/domain';

export const chatApi = {
  /** beforeSeq より前の発言を新しいほうから limit 件（seq の昇順で返る） */
  list: (channelId: string, beforeSeq: number | null, limit: number) =>
    invoke('list_messages', { channelId, beforeSeq, limit }),
  /** 画像・ファイルだけなら content は空でよい */
  send: (channelId: string, content: string, attachments: AttachmentInput[]) =>
    invoke('send_message', { channelId, content, attachments }),
  /** 発言に添えた画像の data URL */
  attachment: (messageId: string, attachmentId: string) => invoke('get_attachment', { messageId, attachmentId }),
  /** 発言に添えたファイルを OS のファイラで表示する */
  reveal: (messageId: string, attachmentId: string) => invoke('reveal_attachment', { messageId, attachmentId }),
  /** 本文に書かれたローカルファイルを OS のファイラで表示する */
  revealLocalFile: (path: string, agentId: string | null) => invoke('reveal_local_file', { path, agentId }),
  /** 本文に書かれたローカル画像を検査して読み込む */
  localImage: (path: string, agentId: string | null) => invoke('read_local_image', { path, agentId }),
  /** チャンネルの割り振り（createdAt の昇順） */
  delegations: (channelId: string) => invoke('list_delegations', { channelId }),
  /** 本文のリンクを OS の既定のブラウザで開く（http・https だけ） */
  openUrl: (url: string) => invoke('open_url', { url }),
};
