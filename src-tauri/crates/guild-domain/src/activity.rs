//! 実行の様子（activity-changed のペイロード）。

use serde::{Deserialize, Serialize};

use super::ids::{AgentId, ChannelId};

/// ジョブを始めたときの表示
pub const THINKING: &str = "考え中…";

/// 実行中の1件（TS の AgentActivity）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentActivity {
    pub agent_id: AgentId,
    pub channel_id: ChannelId,
    /// 例: "考え中…" "Web検索: Unity URP"
    pub detail: String,
}

/// チャンネルごとの実行中・待機中のジョブ数
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelQueue {
    pub channel_id: ChannelId,
    pub running: u32,
    pub pending: u32,
}

/// 全体の最新状態（TS の ActivityState）
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityState {
    pub activities: Vec<AgentActivity>,
    /// 待機・実行中のジョブがあるチャンネルだけ
    pub queues: Vec<ChannelQueue>,
}
