//! 会話プロンプト: 直近の会話 → あなた宛ての未対応の発言（全文引用）→ 注記 → モード別の指示。
//! まとめ（report）のジョブでは、未対応の発言の代わりにサブタスクごとの結果を並べる。
//! 「最後の発言」という指し方はしない（あとから他の発言が続いても取り違えないように）。
//! 添付は「# 添付画像」（どの発言の画像か）と「# 添付ファイル」（読めるパス）で伝える（attachments.rs）。

use super::members::display_name;
use super::{attachments, modes, report, PromptContext};
use crate::conversation::{file_attachments, image_messages, JobMode, JobSpec};
use crate::message::Message;

/// プロンプトに入れる直近の会話の件数
pub const HISTORY_LIMIT: usize = 30;
/// 会話1件あたりの最大文字数
pub const MESSAGE_CHAR_LIMIT: usize = 3000;
/// あなた宛ての未対応の発言（とサブタスクの結果）1件あたりの最大文字数
pub const TRIGGER_CHAR_LIMIT: usize = 8000;

/// 相談元の作業場所（readableDirs に入れて読めるようにしたもの）
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConsultSource {
    pub name: String,
    pub path: String,
}

/// 会話プロンプト。history は seq の昇順
pub fn build_conversation_prompt(
    ctx: &PromptContext<'_>,
    history: &[Message],
    job: &JobSpec,
    sources: &[ConsultSource],
) -> String {
    let transcript = if history.is_empty() {
        "（まだ会話はありません）".to_owned()
    } else {
        entries(ctx, history, MESSAGE_CHAR_LIMIT)
    };
    let mut prompt = format!("# チャンネル #{} の最近の会話\n{transcript}\n\n", ctx.channel.name);
    if job.mode == JobMode::Report {
        prompt.push_str(&report::results(ctx, job));
    } else if !job.triggers.is_empty() {
        let pending = entries(ctx, &job.triggers, TRIGGER_CHAR_LIMIT);
        prompt.push_str(&format!("# あなた宛ての未対応の発言\n{pending}\n\n"));
    }
    let images = image_messages(job, history);
    if !images.is_empty() {
        prompt.push_str(&attachments::images_section(ctx, &images));
    }
    let files = file_attachments(job, history);
    if !files.is_empty() {
        prompt.push_str(&attachments::files_section(ctx, &files));
    }
    if !job.notes.is_empty() {
        let notes: Vec<String> = job.notes.iter().map(|note| format!("- {note}")).collect();
        prompt.push_str(&format!("# 注記\n{}\n\n", notes.join("\n")));
    }
    prompt.push_str(&modes::instruction(ctx, job, sources));
    prompt
}

fn entries(ctx: &PromptContext<'_>, messages: &[Message], limit: usize) -> String {
    messages
        .iter()
        .map(|message| {
            format!(
                "[{}] {}{}:\n{}",
                (ctx.time_label)(message.created_at),
                display_name(&message.author_id, ctx),
                attachments::note(message),
                truncate(&message.content, limit)
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

pub(super) fn truncate(content: &str, limit: usize) -> String {
    if content.chars().count() <= limit {
        return content.to_owned();
    }
    let head: String = content.chars().take(limit).collect();
    format!("{head}\n…（長いので省略）")
}

/// 引用（各行の先頭に「> 」）
pub(super) fn quote(text: &str) -> String {
    text.lines().map(|line| format!("> {line}")).collect::<Vec<_>>().join("\n")
}
