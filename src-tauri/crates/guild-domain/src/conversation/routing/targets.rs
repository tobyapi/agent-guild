//! 振り分けの宛先の選び方: メンションなしで答える人・戻す相手・新しい相談の相手。

use super::{Notice, Routing, RoutingContext};
use crate::agent::{Agent, UnmentionedPolicy};
use crate::conversation::job::{JobMode, JobSpec};
use crate::ids::AgentId;
use crate::message::Message;

/// メンションなしの人間の発言に答える人: チャンネルにいてバックエンドが ready のエージェントのうち、
/// unmentioned が lead の全員（作成順）。いなければ answer の全員、それもいなければ fallback の全員
pub(super) fn default_responders<'a>(ctx: &RoutingContext<'a>) -> Vec<&'a Agent> {
    let eligible: Vec<&Agent> = ctx
        .agents
        .iter()
        .filter(|agent| agent.is_active() && ctx.channel.has_agent(&agent.id))
        .filter(|agent| ctx.ready_backends.contains(&agent.backend))
        .collect();
    let with = |policy: UnmentionedPolicy| -> Vec<&'a Agent> {
        let mut chosen: Vec<&Agent> = eligible.iter().copied().filter(|a| a.behavior().unmentioned == policy).collect();
        chosen.sort_by_key(|agent| agent.created_at);
        chosen
    };
    [UnmentionedPolicy::Lead, UnmentionedPolicy::Answer, UnmentionedPolicy::Fallback]
        .into_iter()
        .map(with)
        .find(|tier| !tier.is_empty())
        .unwrap_or_default()
}

/// 戻す相手: returnTo のうち、自分・削除済み・チャンネル外を除く
pub(super) fn returnable<'a>(job: &JobSpec, author: &AgentId, ctx: &RoutingContext<'a>) -> Vec<&'a Agent> {
    job.return_to
        .iter()
        .filter(|id| *id != author)
        .filter_map(|id| active(ctx, id))
        .filter(|agent| ctx.channel.has_agent(&agent.id))
        .collect()
}

/// 新しい相談: メンバーなら reply ジョブ（returnTo = 発言者）。メンバーでなければ、
/// consultable なエージェントだけ自動で参加させ、そうでなければ「届きませんでした」と知らせる
pub(super) fn consult(
    routing: &mut Routing,
    id: &AgentId,
    author: &AgentId,
    reply: &Message,
    ctx: &RoutingContext<'_>,
) {
    let Some(agent) = active(ctx, id) else {
        return;
    };
    let member = ctx.channel.has_agent(id);
    if !member && !agent.behavior().consultable {
        routing.notices.push(Notice::Undeliverable(agent.name.clone()));
        return;
    }
    if !member {
        routing.joins.push(id.clone());
    }
    routing.jobs.push(JobSpec::respond(id.clone(), reply, JobMode::Reply, vec![author.clone()]));
}

/// 削除されていないエージェント
pub(super) fn active<'a>(ctx: &RoutingContext<'a>, id: &AgentId) -> Option<&'a Agent> {
    ctx.agents.iter().find(|agent| &agent.id == id && agent.is_active())
}
