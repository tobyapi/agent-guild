export interface AgentActivity {
  agentId: string;
  channelId: string;
  /** 例: "考え中…" "Web検索: Unity URP" */
  detail: string;
}

export interface ChannelQueue {
  channelId: string;
  running: number;
  pending: number;
}

export interface ActivityState {
  activities: AgentActivity[];
  /** 待機・実行中のジョブがあるチャンネルだけ */
  queues: ChannelQueue[];
}
