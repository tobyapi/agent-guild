export interface ChannelWorkspace {
  mode: 'legacy' | 'folder' | 'global';
  folder: string | null;
  revision: number;
  afterSeq: number;
}

export interface Channel {
  workspace?: ChannelWorkspace;
  id: string;
  name: string;
  topic: string;
  /** 古いデータで未設定なら false として扱う */
  isLobby?: boolean;
  /** HUMAN_ID またはエージェントID */
  memberIds: string[];
  createdAt: number;
}

/** progress は作業の途中の投稿（進捗状況や困っていること。振り分けない） */
export type MessageKind = 'chat' | 'autonomous' | 'progress' | 'system' | 'error';

/** 人間が発言に貼った画像のメタデータ（中身は get_attachment で data URL として取る） */
export interface Attachment {
  id: string;
  /** 表示用の名前（貼り付けた画像は「image.png」など） */
  name: string;
  /** image/png・image/jpeg・image/gif・image/webp */
  mediaType: string;
  /** バイト数 */
  size: number;
}

/** send_message で送る画像。data は中身の base64（data URL の接頭辞は付けない） */
export interface AttachmentInput {
  name: string;
  mediaType: string;
  data: string;
}

export interface Message {
  id: string;
  /** 全体で単調増加する通し番号。並び順とページングのカーソルはこれを使う（createdAt は表示専用） */
  seq: number;
  channelId: string;
  /** HUMAN_ID / エージェントID / SYSTEM_ID */
  authorId: string;
  content: string;
  /** 人間が貼った画像（貼った順）。人間の発言以外は空 */
  attachments: Attachment[];
  kind: MessageKind;
  /** このメッセージで呼びかけられたエージェントID */
  mentions: string[];
  replyToId: string | null;
  /** 会話の起点（人間の発言・自発投稿）の id。起点自身は自分の id */
  rootId: string;
  /** 人間の発言からの AI 往復回数 */
  depth: number;
  /** この発言（マネージャーの tasks ブロック）から作られた割り振り。なければ null */
  delegationId: string | null;
  createdAt: number;
}

export interface Profile {
  name: string;
  avatar: string;
  color: string;
}
