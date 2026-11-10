//! チャンネルの運用統計。件数はサブタスクと実行で別に数える。

use serde::{Deserialize, Serialize};

use crate::ids::ChannelId;

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct RunUsage {
    pub model: Option<String>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub estimated_cost_nano_usd: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunMeasurement {
    pub job_id: String,
    pub channel_id: ChannelId,
    pub backend: String,
    pub started_at: i64,
    pub duration_ms: i64,
    pub usage: RunUsage,
}

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DelegationStatistics {
    pub delegations: i64,
    pub subtasks: i64,
    pub reported: i64,
    pub failed: i64,
    pub cancelled: i64,
    pub pending: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatistics {
    pub backend: String,
    pub model: Option<String>,
    pub runs: i64,
    pub total_duration_ms: i64,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub token_runs: i64,
    pub estimated_cost_nano_usd: Option<i64>,
    pub cost_runs: i64,
}

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelStatistics {
    pub delegation: DelegationStatistics,
    pub models: Vec<ModelStatistics>,
}
