//! マネージャーの割り振り（design.md §7.1）: tasks ブロックの読み取り・割り振りとサブタスクの状態遷移・決着の判定。
//! JSON の形は TS の `src/shared/types/domain/delegation.ts`。

mod state;
mod tasks;
mod verdict;

use serde::{Deserialize, Serialize};

use crate::ids::{AgentId, ChannelId, DelegationId, MessageId, SubtaskId};

pub use tasks::{parse_tasks, PlannedTask, TaskPlan, MAX_SUBTASKS};
pub use verdict::{carry_subtask, judge, starts_consultation, Settlement, Turn, Verdict};
pub use verdict::{ASSIGNEE_REMOVED, NOT_STARTED, NO_ANSWER, RUN_FAILED, TIMED_OUT};

/// サブタスクの状態（TS の SubtaskStatus）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SubtaskStatus {
    /// 担当者の実行待ち
    Pending,
    /// 担当者が作業中（相談相手の回答待ちを含む）
    Running,
    Done,
    Failed,
    Cancelled,
}

impl SubtaskStatus {
    /// 保存で使う識別子
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Running => "running",
            Self::Done => "done",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        [Self::Pending, Self::Running, Self::Done, Self::Failed, Self::Cancelled]
            .into_iter()
            .find(|status| status.as_str() == value)
    }

    /// まだ決着していない（pending / running）
    pub fn is_open(self) -> bool {
        matches!(self, Self::Pending | Self::Running)
    }
}

/// 割り振りの状態（TS の DelegationStatus）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DelegationStatus {
    /// サブタスクのどれかが未決着
    Running,
    /// 全サブタスクが決着し、マネージャーがまとめを書いている
    Reporting,
    Done,
    Cancelled,
}

impl DelegationStatus {
    /// 保存で使う識別子
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Reporting => "reporting",
            Self::Done => "done",
            Self::Cancelled => "cancelled",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        [Self::Running, Self::Reporting, Self::Done, Self::Cancelled]
            .into_iter()
            .find(|status| status.as_str() == value)
    }

    /// まだ終わっていない（running / reporting）
    pub fn is_open(self) -> bool {
        matches!(self, Self::Running | Self::Reporting)
    }
}

/// TS の Subtask
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Subtask {
    pub id: SubtaskId,
    pub assignee_id: AgentId,
    /// マネージャーが書いた指示
    pub instruction: String,
    pub status: SubtaskStatus,
    /// 結果の報告（done）や失敗の記録（failed のエラー発言）
    pub result_message_id: Option<MessageId>,
    /// failed / cancelled の理由
    pub note: Option<String>,
}

/// TS の Delegation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Delegation {
    pub id: DelegationId,
    pub channel_id: ChannelId,
    pub manager_id: AgentId,
    /// tasks ブロックを含むマネージャーの発言
    pub message_id: MessageId,
    pub status: DelegationStatus,
    /// tasks ブロックに書かれた順
    pub subtasks: Vec<Subtask>,
    /// マネージャーのまとめの発言
    pub summary_message_id: Option<MessageId>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// ジョブが決着させるサブタスク（task ジョブ・担当者の相談の連鎖・担当者のまとめのジョブが持つ）
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SubtaskRef {
    pub delegation_id: DelegationId,
    pub subtask_id: SubtaskId,
    pub assignee_id: AgentId,
}

impl Delegation {
    /// サブタスクを指す参照
    pub fn subtask_ref(&self, subtask: &Subtask) -> SubtaskRef {
        SubtaskRef {
            delegation_id: self.id.clone(),
            subtask_id: subtask.id.clone(),
            assignee_id: subtask.assignee_id.clone(),
        }
    }

    pub fn subtask(&self, id: &SubtaskId) -> Option<&Subtask> {
        self.subtasks.iter().find(|subtask| &subtask.id == id)
    }
}
