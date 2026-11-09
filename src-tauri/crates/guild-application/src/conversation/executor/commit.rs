//! 実行結果の確定（アクターの中で、世代と取り消しを確かめたあとに呼ばれる）: 返答・エラーの保存と振り分け、
//! マネージャーの返答の tasks ブロックからの割り振り（delegate.rs）。

use guild_domain::agent::Agent;
use guild_domain::author::Author;
use guild_domain::conversation::{
    format_reply, notices, parse_mentions, route_no_answer, route_reply, JobMode, JobSpec, NoAnswer,
    RoutingContext,
};
use guild_domain::delegation::{carry_subtask, parse_tasks, starts_consultation};
use guild_domain::ids::{AgentId, DelegationId, MessageId};
use guild_domain::message::{Message, MessageKind, NewMessage};

use super::ending::{Committed, Ending};
use super::request::participants;
use super::{delegate, RunOutcome};
use crate::conversation::posting::{self, Origin};
use crate::error::AppResult;
use crate::services::Ports;

/// 結果を保存し、振り分けの結果と結末を返す
pub(crate) fn commit(ports: &Ports, job: &JobSpec, outcome: RunOutcome) -> AppResult<Committed> {
    let Some((agent, channel)) = participants(ports, job)? else {
        return Ok(Committed::nothing());
    };
    let agents = ports.agents.list()?;
    let ready = posting::ready_backends(ports);
    let ctx = RoutingContext { channel: &channel, agents: &agents, ready_backends: &ready };
    match outcome {
        RunOutcome::Reply(raw) => match format_reply(&raw, &agent.name) {
            Some(content) => replied(ports, job, &agent, content, &ctx),
            None => Ok(no_answer(job, &agent, NoAnswer::Passed, &ctx, Ending::Passed)),
        },
        RunOutcome::Failed(message) => {
            let error = post_error(ports, job, &agent, message)?;
            Ok(no_answer(job, &agent, NoAnswer::Failed, &ctx, Ending::Failed(error)))
        }
        RunOutcome::TimedOut => {
            let error = post_error(ports, job, &agent, notices::TIMED_OUT.to_owned())?;
            Ok(no_answer(job, &agent, NoAnswer::Failed, &ctx, Ending::TimedOut(error)))
        }
        RunOutcome::Cancelled | RunOutcome::Skipped => Ok(Committed::nothing()),
    }
}

/// 返答を投稿して振り分ける。canDelegate のエージェントの tasks ブロックは割り振りにする
fn replied(ports: &Ports, job: &JobSpec, agent: &Agent, content: String, ctx: &RoutingContext<'_>) -> AppResult<Committed> {
    let plan = if agent.behavior().can_delegate { parse_tasks(&content, &agent.id, ctx.agents) } else { None };
    let delegation_id = plan.as_ref().filter(|plan| !plan.tasks.is_empty()).map(|_| DelegationId::new(ports.ids.new_id()));
    let reply = post_reply(ports, job, agent, content, ctx.agents, delegation_id.clone())?;
    let mut routing = route_reply(&reply, job, ctx);
    carry_subtask(job, &mut routing);
    let consulted = starts_consultation(&routing);
    let delegation = match plan {
        Some(plan) => delegate::start(ports, &reply, plan, delegation_id, ctx, &mut routing)?,
        None => None,
    };
    let continues = consulted || delegation.is_some();
    let origin = Origin::of(&reply);
    Ok(Committed { routing: Some((routing, origin)), ending: Ending::Replied { message: reply, continues }, delegation })
}

/// 返答がなかった（[PASS]・空・失敗・時間切れ）ので、呼び出し元に注記つきで戻す
fn no_answer(job: &JobSpec, agent: &Agent, reason: NoAnswer, ctx: &RoutingContext<'_>, ending: Ending) -> Committed {
    let routing = job.root_id.clone().map(|root_id| {
        let mut routing = route_no_answer(job, agent, reason, ctx);
        carry_subtask(job, &mut routing);
        (routing, Origin { channel_id: job.channel_id.clone(), root_id, depth: job.depth })
    });
    Committed { routing, ending, delegation: None }
}

fn post_reply(
    ports: &Ports,
    job: &JobSpec,
    agent: &Agent,
    content: String,
    agents: &[Agent],
    delegation_id: Option<DelegationId>,
) -> AppResult<Message> {
    let mentions: Vec<AgentId> = parse_mentions(&content, agents)
        .into_iter()
        .filter(|id| id != &agent.id)
        .collect();
    let kind = if job.mode == JobMode::Autonomous { MessageKind::Autonomous } else { MessageKind::Chat };
    let message = NewMessage { delegation_id, ..from_job(ports, job, agent, content, kind, mentions) };
    posting::publish(ports, message)
}

/// 失敗はそのエージェント名義の kind=error の発言にする
fn post_error(ports: &Ports, job: &JobSpec, agent: &Agent, content: String) -> AppResult<Message> {
    posting::publish(ports, from_job(ports, job, agent, content, MessageKind::Error, Vec::new()))
}

/// ジョブから生まれる発言（起点・depth・返信先を引き継ぐ。自発活動なら自分が起点）
fn from_job(
    ports: &Ports,
    job: &JobSpec,
    agent: &Agent,
    content: String,
    kind: MessageKind,
    mentions: Vec<AgentId>,
) -> NewMessage {
    let id = MessageId::new(ports.ids.new_id());
    NewMessage {
        root_id: job.root_id.clone().unwrap_or_else(|| id.clone()),
        id,
        channel_id: job.channel_id.clone(),
        author_id: Author::Agent(agent.id.clone()),
        content,
        attachments: Vec::new(),
        kind,
        mentions,
        reply_to_id: job.latest_trigger().map(|message| message.id.clone()),
        depth: job.depth,
        delegation_id: None,
        created_at: ports.clock.now_ms(),
    }
}
