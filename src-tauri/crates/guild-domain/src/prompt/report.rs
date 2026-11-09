//! まとめ（report）のジョブ（§7.1-4・§8）: 割り振ったタスクの結果をサブタスクごとに並べ、統合して人間に報告するよう指示する。
//! 結果の本文は report ジョブのきっかけ（各サブタスクの結果の発言）から引く。

use super::conversation::{quote, truncate, TRIGGER_CHAR_LIMIT};
use super::members::name_of;
use super::PromptContext;
use crate::conversation::JobSpec;
use crate::delegation::{Subtask, SubtaskStatus};

/// サブタスクごとの「担当者・指示・状態・結果（全文、1件8000文字まで）か理由」
pub(super) fn results(ctx: &PromptContext<'_>, job: &JobSpec) -> String {
    let Some(delegation) = ctx.delegation.filter(|delegation| job.report.as_ref() == Some(&delegation.id)) else {
        return String::new();
    };
    let entries: Vec<String> = delegation
        .subtasks
        .iter()
        .enumerate()
        .map(|(index, subtask)| entry(ctx, job, index + 1, subtask))
        .collect();
    format!("# 割り振ったタスクの結果がそろいました\n{}\n\n", entries.join("\n\n"))
}

fn entry(ctx: &PromptContext<'_>, job: &JobSpec, number: usize, subtask: &Subtask) -> String {
    let message = subtask
        .result_message_id
        .as_ref()
        .and_then(|id| job.triggers.iter().find(|message| &message.id == id))
        .map(|message| truncate(&message.content, TRIGGER_CHAR_LIMIT));
    let outcome = match (subtask.status, message) {
        (SubtaskStatus::Done, Some(result)) => format!("結果:\n{result}"),
        (_, message) => {
            let reason = subtask.note.as_deref().unwrap_or("（理由は記録されていません）");
            match message {
                Some(detail) => format!("理由: {reason}\n{detail}"),
                None => format!("理由: {reason}"),
            }
        }
    };
    format!(
        "## {number}. @{}（{}）\n指示:\n{}\n{outcome}",
        name_of(ctx, &subtask.assignee_id),
        status_label(subtask.status),
        quote(&subtask.instruction)
    )
}

fn status_label(status: SubtaskStatus) -> &'static str {
    match status {
        SubtaskStatus::Done => "完了",
        SubtaskStatus::Failed => "失敗",
        SubtaskStatus::Cancelled => "取り消し",
        SubtaskStatus::Pending | SubtaskStatus::Running => "未完了",
    }
}

pub(super) fn instruction(ctx: &PromptContext<'_>) -> String {
    format!(
        "# あなたの番です（まとめ）
上の結果を統合して、人間（{}）への報告を書いてください。
- 依頼に対して全体として何が分かったか・何ができたかを、要点から簡潔に。担当者ごとの結果の要点も添える。
- 結果どうしの矛盾・抜け・失敗したタスクがあれば、はっきり指摘する。
- 足りないところがあれば、tasks ブロックで追加の割り振りをして構いません（結果がそろったら、もう一度あなたの番が回ってきます）。",
        ctx.me.name
    )
}
