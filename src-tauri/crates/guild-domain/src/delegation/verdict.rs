//! サブタスクの決着の判定（§7.1-3）と、担当者の相談の連鎖へのサブタスクの引き継ぎ。

use crate::conversation::{JobMode, JobSpec, Routing};
use crate::ids::MessageId;
use crate::locale::Language;

/// サブタスクが失敗で決着した理由（作った時点の言語の文面で保存する）
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubtaskNote {
    /// [PASS]・空の返答で終わった
    NoAnswer,
    /// 実行が失敗した
    RunFailed,
    /// 時間切れで中断した
    TimedOut,
    /// 担当者が削除された・チャンネルから外された
    AssigneeRemoved,
    /// task ジョブが実行されないまま消えた
    NotStarted,
}

impl SubtaskNote {
    pub fn text(self, language: Language) -> &'static str {
        language.pick(match self {
            Self::NoAnswer => {
                ["回答がありませんでした", "No answer.", "没有回答。", "沒有回答。", "답변이 없었습니다."]
            }
            Self::RunFailed => ["失敗しました", "Failed.", "执行失败。", "執行失敗。", "실패했습니다."],
            Self::TimedOut => [
                "時間切れで中断しました",
                "Timed out.",
                "已超时中断。",
                "已逾時中斷。",
                "시간이 초과되어 중단했습니다.",
            ],
            Self::AssigneeRemoved => [
                "担当者が外れました",
                "The assignee was removed.",
                "负责人已被移除。",
                "負責人已被移除。",
                "담당자가 빠졌습니다.",
            ],
            Self::NotStarted => ["実行されませんでした", "Never ran.", "未执行。", "未執行。", "실행되지 않았습니다."],
        })
    }

    /// この理由での失敗の決着（理由は language の文面）
    pub fn settle(self, language: Language, message: Option<MessageId>) -> Settlement {
        Settlement::Failed { note: self.text(language), message }
    }
}

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

/// サブタスクを持つジョブが、その担当者のジョブとして終わったときの判定（失敗の理由は language の文面）
pub fn judge(turn: Turn<'_>, language: Language) -> Verdict {
    let settlement = match turn {
        Turn::Replied { continues: true, .. } => return Verdict::Waiting,
        Turn::Replied { message, continues: false } => Settlement::Done(message.clone()),
        Turn::Passed => SubtaskNote::NoAnswer.settle(language, None),
        Turn::Failed { error } => SubtaskNote::RunFailed.settle(language, Some(error.clone())),
        Turn::TimedOut { error } => SubtaskNote::TimedOut.settle(language, Some(error.clone())),
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
