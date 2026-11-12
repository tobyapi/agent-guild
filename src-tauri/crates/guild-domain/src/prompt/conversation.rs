//! 会話プロンプト: この会話の発言（人間の発言に応えるときはチャンネルの最近の発言も。自発活動はチャンネルの最近の発言だけ）→
//! あなた宛ての未対応の発言（全文引用）→ 注記 → モード別の指示。それ以外の別の会話の発言は入れない
//! （関係のない話に引きずられないように）。
//! まとめ（report）のジョブでは、未対応の発言の代わりにサブタスクごとの結果を並べる。
//! 「最後の発言」という指し方はしない（あとから他の発言が続いても取り違えないように）。
//! 日本語以外の言語では、最後にその言語で書く念押しを1行足す（language.rs）。
//! 添付は「# 添付画像」（どの発言の画像か）と「# 添付ファイル」（読めるパス）で伝える（attachments.rs）。

use super::members::display_name;
use super::{attachments, language, modes, report, PromptContext};
use crate::author::Author;
use crate::conversation::{file_attachments, image_messages, JobMode, JobSpec};
use crate::message::{Message, MessageKind};

/// プロンプトに入れる、この会話の発言の件数（新しい方から。会話の起点の発言はこれとは別に必ず入れる）
pub const HISTORY_LIMIT: usize = 30;
/// チャンネルの最近の発言として入れる件数（会話のない自発活動と、人間の発言に応えるジョブ）
pub const RECENT_CHANNEL_LIMIT: usize = 10;
/// 作業の途中の投稿（kind=progress）を入れる件数。上の2つの件数には数えず、それぞれの範囲にあるものを新しい方から
pub const PROGRESS_LIMIT: usize = 10;
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

/// 会話プロンプト。history は seq の昇順（会話のあるジョブはその会話の発言、自発活動はチャンネルの最近の発言）
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
    let heading = if job.conversations().next().is_none() {
        format!("# チャンネル #{} の最近の発言", ctx.channel.name)
    } else if job.triggers.iter().any(|trigger| trigger.author_id == Author::Human) {
        format!("# この会話と、チャンネル #{} の最近の発言", ctx.channel.name)
    } else {
        "# この会話のこれまでの発言".to_owned()
    };
    let mut prompt = format!("{heading}\n{transcript}\n\n");
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
    let reminder = language::reminder(ctx.language);
    if !reminder.is_empty() {
        prompt.push_str(&format!(
            "

{reminder}"
        ));
    }
    prompt
}

fn entries(ctx: &PromptContext<'_>, messages: &[Message], limit: usize) -> String {
    messages
        .iter()
        .map(|message| {
            format!(
                "[{}] {}{}{}:\n{}",
                (ctx.time_label)(message.created_at),
                display_name(&message.author_id, ctx),
                progress_note(message),
                attachments::note(message),
                truncate(&message.content, limit)
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// 作業の途中の投稿なら、最後の返答と取り違えないように印をつける
fn progress_note(message: &Message) -> &'static str {
    if message.kind == MessageKind::Progress {
        "（途中経過）"
    } else {
        ""
    }
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
