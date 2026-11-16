//! 作業の途中の投稿: ジョブの返答と同じ位置（起点・depth・返信先）に kind=progress の発言として保存する。
//! 振り分けはしない（本文にメンションがあっても記録せず、通知もしない）。

use guild_domain::conversation::{format_reply, JobSpec};
use guild_domain::message::{Message, MessageKind};

use super::commit::from_job;
use super::request::participants;
use crate::conversation::posting;
use crate::error::AppResult;
use crate::services::Ports;

/// 保存した発言を返す。空・[PASS]、またはエージェントかチャンネルがもうなければ何もしない
pub(crate) fn post_progress(
    ports: &Ports,
    job: &JobSpec,
    raw: &str,
    usage: Option<guild_domain::skill_usage::SkillUsage>,
) -> AppResult<Option<Message>> {
    let Some((agent, _channel)) = participants(ports, job)? else {
        return Ok(None);
    };
    let (body, names) = guild_domain::skill_usage::declaration(raw);
    let mut usage = usage.unwrap_or_default();
    usage.declared = names;
    let Some(content) = format_reply(&body, &agent.name) else {
        return Ok(None);
    };
    let mut message = from_job(ports, job, &agent, content, MessageKind::Progress, Vec::new());
    message.skill_usage = Some(usage);
    posting::publish(ports, message).map(Some)
}
