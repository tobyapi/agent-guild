//! 割り振りとサブタスクの状態遷移。どれも変わったら true を返す（呼び出し側が保存して delegation-changed を出す）。
//! 終わった割り振り（done / cancelled）はもう変わらない。

use super::{Delegation, DelegationStatus, Settlement, SubtaskStatus, ASSIGNEE_REMOVED};
use crate::ids::{AgentId, MessageId, SubtaskId};

impl Delegation {
    /// 担当者のジョブが始まった: pending → running
    pub fn start_subtask(&mut self, id: &SubtaskId, now: i64) -> bool {
        if self.status != DelegationStatus::Running {
            return false;
        }
        let Some(subtask) = self.subtasks.iter_mut().find(|s| &s.id == id && s.status == SubtaskStatus::Pending) else {
            return false;
        };
        subtask.status = SubtaskStatus::Running;
        self.updated_at = now;
        true
    }

    /// 未決着のサブタスクを決着させる
    pub fn settle_subtask(&mut self, id: &SubtaskId, settlement: Settlement, now: i64) -> bool {
        if self.status != DelegationStatus::Running {
            return false;
        }
        let Some(subtask) = self.subtasks.iter_mut().find(|s| &s.id == id && s.status.is_open()) else {
            return false;
        };
        match settlement {
            Settlement::Done(message) => {
                subtask.status = SubtaskStatus::Done;
                subtask.result_message_id = Some(message);
                subtask.note = None;
            }
            Settlement::Failed { note, message } => {
                subtask.status = SubtaskStatus::Failed;
                subtask.result_message_id = message;
                subtask.note = Some(note.to_owned());
            }
        }
        self.updated_at = now;
        true
    }

    /// 担当者が外れた（削除・除外）: その担当者の未決着のサブタスクを failed「担当者が外れました」に
    pub fn fail_assignee(&mut self, agent: &AgentId, now: i64) -> bool {
        let open: Vec<SubtaskId> = self
            .subtasks
            .iter()
            .filter(|s| &s.assignee_id == agent && s.status.is_open())
            .map(|s| s.id.clone())
            .collect();
        let failed = Settlement::Failed { note: ASSIGNEE_REMOVED, message: None };
        let mut changed = false;
        for id in &open {
            changed |= self.settle_subtask(id, failed.clone(), now);
        }
        changed
    }

    /// 全サブタスクが決着した（まとめに進める）か
    pub fn is_ready_to_report(&self) -> bool {
        self.status == DelegationStatus::Running && self.subtasks.iter().all(|s| !s.status.is_open())
    }

    /// 待ち合わせ: 全サブタスクが決着したら reporting にする
    pub fn begin_report(&mut self, now: i64) -> bool {
        if !self.is_ready_to_report() {
            return false;
        }
        self.status = DelegationStatus::Reporting;
        self.updated_at = now;
        true
    }

    /// まとめが終わった（[PASS]・失敗なら summary は None）: reporting → done
    pub fn finish(&mut self, summary: Option<MessageId>, now: i64) -> bool {
        if self.status != DelegationStatus::Reporting {
            return false;
        }
        self.status = DelegationStatus::Done;
        self.summary_message_id = summary;
        self.updated_at = now;
        true
    }

    /// 打ち切り（停止・チャンネル削除・マネージャーの削除や除外）: 未決着のサブタスクも cancelled に
    pub fn cancel(&mut self, now: i64) -> bool {
        if !self.status.is_open() {
            return false;
        }
        self.status = DelegationStatus::Cancelled;
        for subtask in self.subtasks.iter_mut().filter(|s| s.status.is_open()) {
            subtask.status = SubtaskStatus::Cancelled;
        }
        self.updated_at = now;
        true
    }
}
