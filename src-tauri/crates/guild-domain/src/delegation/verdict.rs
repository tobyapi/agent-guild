//! サブタスクの決着の判定（§7.1-3）と、担当者の相談の連鎖へのサブタスクの引き継ぎ。

use crate::conversation::{JobMode, JobSpec, Routing};
use crate::ids::MessageId;

/// [PASS]・空の返答で終わった
pub const NO_ANSWER: &str = "回答がありませんでした";
/// 実行が失敗した
pub const RUN_FAILED: &str = "失敗しました";
/// 時間切れで中断した
pub const TIMED_OUT: &str = "時間切れで中断しました";
/// 担当者が削除された・チャンネルから外された
pub const ASSIGNEE_REMOVED: &str = "担当者が外れました";
/// task ジョブが実行されないまま消えた
pub const NOT_STARTED: &str = "実行されませんでした";

/// サブタスクの決着のしかた
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Settlement {
    /// 結果の報告（その返答）
    Done(MessageId),
    /// 理由と、あればエラー発言
    Failed { note: &'static str, message: Option<MessageId> },
}

/// 担当者のジョブの結末
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Turn<'a> {
    /// 返答を投稿した。continues = その返答が新しい相談か新しい割り振りを作った
    Replied { message: &'a MessageId, continues: bool },
    /// [PASS]・空の返答
    Passed,
    /// 失敗（error はエラー発言）
    Failed { error: &'a MessageId },
    /// 時間切れ（error はエラー発言）
    TimedOut { error: &'a MessageId },
}

/// 判定の結果
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Verdict {
    /// 相談相手の回答や入れ子の割り振りの結果を待つ（running のまま。戻りのジョブが終わったらもう一度判定する）
    Waiting,
    Settle(Settlement),
}

/// サブタスクを持つジョブが、その担当者のジョブとして終わったときの判定
pub fn judge(turn: Turn<'_>) -> Verdict {
    let settlement = match turn {
        Turn::Replied { continues: true, .. } => return Verdict::Waiting,
        Turn::Replied { message, continues: false } => Settlement::Done(message.clone()),
        Turn::Passed => Settlement::Failed { note: NO_ANSWER, message: None },
        Turn::Failed { error } => Settlement::Failed { note: RUN_FAILED, message: Some(error.clone()) },
        Turn::TimedOut { error } => Settlement::Failed { note: TIMED_OUT, message: Some(error.clone()) },
    };
    Verdict::Settle(settlement)
}

/// 振り分けの結果に新しい相談（§7 の 2 の reply ジョブ）があるか
pub fn starts_consultation(routing: &Routing) -> bool {
    routing.jobs.iter().any(|job| job.mode == JobMode::Reply)
}

/// ジョブ job のサブタスクを、担当者の相談の連鎖に引き継ぐ: 担当者の返答から生まれた新しい相談（reply ジョブ）と、
/// 相談相手から担当者に戻る return ジョブ。ほかのジョブ（相談相手がさらに相談したものなど）は引き継がない
pub fn carry_subtask(job: &JobSpec, routing: &mut Routing) {
    let Some(subtask) = &job.subtask else {
        return;
    };
    let from_assignee = job.agent_id == subtask.assignee_id;
    for next in &mut routing.jobs {
        let continues = if from_assignee {
            next.mode == JobMode::Reply
        } else {
            next.mode == JobMode::Return && next.agent_id == subtask.assignee_id
        };
        if continues {
            next.subtask = Some(subtask.clone());
        }
    }
}
