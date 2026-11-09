//! プロンプトに入れる発言（design.md §8）: 会話のあるジョブは、その会話（起点）の発言。起点の発言は必ず入れ、
//! ほかは新しい方から HISTORY_LIMIT 件まで。人間の発言に応えるときは、チャンネルの最近の発言 RECENT_CHANNEL_LIMIT 件も
//! 合わせる（人間の発言は1件ずつが新しい会話の起点なので、「それ」「さっきの」が指す直前の流れが別の会話にあるため）。
//! 会話のない自発活動は、チャンネルの最近の発言 RECENT_CHANNEL_LIMIT 件だけ。

use guild_domain::author::Author;
use guild_domain::conversation::JobSpec;
use guild_domain::ids::MessageId;
use guild_domain::message::Message;
use guild_domain::prompt::{HISTORY_LIMIT, RECENT_CHANNEL_LIMIT};

use crate::error::AppResult;
use crate::services::Ports;

/// seq の昇順（重複なし）
pub(super) fn history(ports: &Ports, job: &JobSpec) -> AppResult<Vec<Message>> {
    let mut roots: Vec<MessageId> = Vec::new();
    for root in job.conversations() {
        if !roots.contains(root) {
            roots.push(root.clone());
        }
    }
    if roots.is_empty() {
        return ports.messages.list(&job.channel_id, None, RECENT_CHANNEL_LIMIT);
    }
    let mut messages = ports.messages.list_in_conversations(&job.channel_id, &roots, HISTORY_LIMIT)?;
    for root in &roots {
        if messages.iter().any(|message| &message.id == root) {
            continue;
        }
        if let Some(first) = ports.messages.get(root)?.filter(|first| first.channel_id == job.channel_id) {
            messages.push(first);
        }
    }
    if job.triggers.iter().any(|trigger| trigger.author_id == Author::Human) {
        for recent in ports.messages.list(&job.channel_id, None, RECENT_CHANNEL_LIMIT)? {
            if !messages.iter().any(|message| message.id == recent.id) {
                messages.push(recent);
            }
        }
    }
    messages.sort_by_key(|message| message.seq);
    Ok(messages)
}
