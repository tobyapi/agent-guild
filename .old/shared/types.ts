// サーバとフロントで共有する型

export type AgentKind = 'worker' | 'expert';
export type BackendId = 'claude' | 'codex';

export const HUMAN_ID = 'me';

export interface Agent {
  id: string;
  kind: AgentKind;
  name: string;
  /** 絵文字1文字、または data:image/... の画像 */
  avatar: string;
  color: string;
  /** 役割（例: リサーチと企画担当） */
  role: string;
  /** 性格 */
  personality: string;
  /** 口調（例: 敬語でやわらかく、語尾に「〜ですね」） */
  tone: string;
  /** 専門分野（専門家のみ意味を持つ） */
  expertise: string;
  backend: BackendId;
  /** 空なら各バックエンドの既定モデル */
  model: string;
  /** 作業者の自発活動 */
  autonomyEnabled: boolean;
  autonomyIntervalMin: number;
  autonomyChannelId: string | null;
  lastAutonomousAt: number | null;
  createdAt: number;
}

export interface Skill {
  id: string;
  agentId: string;
  /** フォルダ名にもなる英数字ハイフン */
  name: string;
  description: string;
  body: string;
  updatedAt: number;
}

export interface Channel {
  id: string;
  name: string;
  topic: string;
  /** HUMAN_ID またはエージェントID */
  memberIds: string[];
  createdAt: number;
}

export type MessageKind = 'chat' | 'autonomous' | 'system' | 'error';

export interface Message {
  id: string;
  channelId: string;
  /** HUMAN_ID / エージェントID / 'system' */
  authorId: string;
  content: string;
  kind: MessageKind;
  /** このメッセージで呼びかけられたエージェント */
  mentions: string[];
  /** どのメッセージへの応答として生まれたか */
  replyToId: string | null;
  /** 人間の発言からの AI 往復回数 */
  depth: number;
  createdAt: number;
}

export interface Profile {
  name: string;
  avatar: string;
  color: string;
}

export interface AppState {
  me: Profile;
  agents: Agent[];
  channels: Channel[];
  backends: BackendInfo[];
}

export interface BackendInfo {
  id: BackendId;
  label: string;
  modelSuggestions: string[];
  defaultModel: string;
}

export interface AgentActivity {
  agentId: string;
  channelId: string;
  /** 例: "考え中…" "Web検索: Unity URP" */
  detail: string;
}

export type ServerEvent =
  | { type: 'message.created'; message: Message }
  | { type: 'activity'; activities: AgentActivity[] }
  | { type: 'state.changed' };
