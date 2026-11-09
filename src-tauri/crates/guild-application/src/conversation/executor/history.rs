//! プロンプトに入れる発言（design.md §8）: 会話のあるジョブは、その会話（起点）の発言。起点の発言は必ず入れ、
//! ほかは新しい方から HISTORY_LIMIT 件まで。人間の発言に応えるときは、チャンネルの最近の発言 RECENT_CHANNEL_LIMIT 件も
//! 合わせる（人間の発言は1件ずつが新しい会話の起点なので、「それ」「さっきの」が指す直前の流れが別の会話にあるため）。
//! 会話のない自発活動は、チャンネルの最近の発言 RECENT_CHANNEL_LIMIT 件だけ。
//! 作業の途中の投稿（kind=progress）は数が多いので、これらの件数には数えない（返答を押し出さないように）。
//! それぞれの範囲（入れる発言のいちばん古いものよりあと）にあるものを、新しい方から PROGRESS_LIMIT 件まで足す。

use guild_domain::author::Author;
use guild_domain::conversation::JobSpec;
use guild_domain::ids::MessageId;
use guild_domain::message::Message;
use guild_domain::prompt::{HISTORY_LIMIT, PROGRESS_LIMIT, RECENT_CHANNEL_LIMIT};

use crate::error::AppResult;
use crate::ports::MessageFilter;
use crate::services::Ports;

/// seq の昇順（重複なし）
pub(super) fn history(ports: &Ports, job: &JobSpec) -> AppResult<Vec<Message>> {
    let mut roots: Vec<MessageId> = Vec::new();
    for root in job.conversations() {
        if !roots.contains(root) {
            roots.push(root.clone());
        }
    }
    let mut messages = if roots.is_empty() { recent(ports, job)? } else { conversations(ports, job, &roots)? };
    for root in &roots {
        if messages.iter().any(|message| &message.id == root) {
            continue;
        }
        if let Some(first) = ports.messages.get(root)?.filter(|first| first.channel_id == job.channel_id) {
            messages.push(first);
        }
    }
    if !roots.is_empty() && job.triggers.iter().any(|trigger| trigger.author_id == Author::Human) {
        for recent in recent(ports, job)? {
            if !messages.iter().any(|message| message.id == recent.id) {
                messages.push(recent);
            }
        }
    }
    messages.sort_by_key(|message| message.seq);
    Ok(messages)
}

/// 関わる会話の発言（新しい方から HISTORY_LIMIT 件）と、その範囲の途中の投稿
fn conversations(ports: &Ports, job: &JobSpec, roots: &[MessageId]) -> AppResult<Vec<Message>> {
    let list = |filter, limit| ports.messages.list_in_conversations(&job.channel_id, roots, filter, limit);
    let messages = list(MessageFilter::WithoutProgress, HISTORY_LIMIT)?;
    Ok(with_progress(messages, list(MessageFilter::ProgressOnly, PROGRESS_LIMIT)?))
}

/// チャンネルの最近の発言（新しい方から RECENT_CHANNEL_LIMIT 件）と、その範囲の途中の投稿
fn recent(ports: &Ports, job: &JobSpec) -> AppResult<Vec<Message>> {
    let list = |filter, limit| ports.messages.list(&job.channel_id, filter, None, limit);
    let messages = list(MessageFilter::WithoutProgress, RECENT_CHANNEL_LIMIT)?;
    Ok(with_progress(messages, list(MessageFilter::ProgressOnly, PROGRESS_LIMIT)?))
}

/// 発言 messages（seq の昇順）に、そのいちばん古い発言よりあとの途中の投稿を足す（古い流れの途中経過は入れない）
fn with_progress(mut messages: Vec<Message>, progress: Vec<Message>) -> Vec<Message> {
    let oldest = messages.first().map_or(i64::MIN, |message| message.seq);
    messages.extend(progress.into_iter().filter(|post| post.seq > oldest));
    messages
}
