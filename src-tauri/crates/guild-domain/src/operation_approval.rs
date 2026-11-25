//! An approval card is runtime state and does not enter chat history or the model's context.
use crate::ids::ChannelId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ApprovalDecision {
    Approved,
    Denied,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Denied,
    TimedOut,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalRequest {
    pub request_id: String,
    pub operation: String,
    pub workspace: String,
    pub detail: String,
    pub reason: String,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationApproval {
    pub run_id: String,
    pub channel_id: ChannelId,
    pub agent_name: String,
    #[serde(flatten)]
    pub request: ApprovalRequest,
    pub status: ApprovalStatus,
}
