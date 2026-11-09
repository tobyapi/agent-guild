//! 会話の振り分け（design.md §7）。純粋関数で、参加させる相手・積むジョブ・出すお知らせを返すだけ。

mod targets;

use super::job::{JobMode, JobSpec};
use super::notices;
use crate::agent::Agent;
use crate::channel::Channel;
use crate::ids::AgentId;
use crate::message::Message;

/// AI 同士の往復の上限（この depth に達した返答からは振り分けない）
pub const MAX_DEPTH: u32 = 10;

/// 振り分けに必要な状況
#[derive(Debug, Clone, Copy)]
pub struct RoutingContext<'a> {
    pub channel: &'a Channel,
    /// 全エージェント（削除済みを含んでよい）
    pub agents: &'a [Agent],
    /// status が ready のバックエンドの ID
    pub ready_backends: &'a [String],
}

/// 振り分けで出すシステム発言
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Notice {
    /// メンションなしの人間の発言に答えられるエージェントがいない
    NoResponder,
    /// depth が上限に達した（起点ごとに1回だけ出すのは呼び出し側の責務）
    DepthLimit,
    /// メンションされた相手（名前）がチャンネルにおらず、自動参加もしない
    Undeliverable(String),
    /// tasks ブロックの割り振れなかった名前（見つからない・削除済み・自分自身）
    Unassignable(Vec<String>),
    /// サブタスクの上限を超えて飛ばした担当者の名前
    TooManyTasks(Vec<String>),
}

impl Notice {
    pub fn text(&self) -> String {
        match self {
            Self::NoResponder => notices::NO_RESPONDER.to_owned(),
            Self::DepthLimit => notices::DEPTH_LIMIT.to_owned(),
            Self::Undeliverable(name) => notices::undeliverable(name),
            Self::Unassignable(names) => notices::unassignable(names),
            Self::TooManyTasks(names) => notices::too_many_tasks(names),
        }
    }
}

/// 振り分けの結果。呼び出し側は joins を参加させて「参加しました」を出し、notices を出してから jobs を積む
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Routing {
    pub joins: Vec<AgentId>,
    pub jobs: Vec<JobSpec>,
    pub notices: Vec<Notice>,
}

/// 返答がなかった理由（§7-3）
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NoAnswer {
    /// [PASS] や空の返答
    Passed,
    /// 失敗・時間切れ
    Failed,
}

/// §7-1: 人間の発言。メンションがあれば呼ばれた全員（チャンネル外なら設定に関係なく参加させる）、
/// なければ答えられる人のうち unmentioned が lead の全員、いなければ answer の全員、それもいなければ fallback の全員（作成順）
pub fn route_human_message(message: &Message, ctx: &RoutingContext<'_>) -> Routing {
    let mut routing = Routing::default();
    if !message.kind.is_routable() {
        return routing;
    }
    if message.mentions.is_empty() {
        let responders = targets::default_responders(ctx);
        if responders.is_empty() {
            routing.notices.push(Notice::NoResponder);
        }
        for agent in responders {
            routing.jobs.push(JobSpec::respond(agent.id.clone(), message, JobMode::Reply, Vec::new()));
        }
        return routing;
    }
    for agent in message.mentions.iter().filter_map(|id| targets::active(ctx, id)) {
        if !ctx.channel.has_agent(&agent.id) {
            routing.joins.push(agent.id.clone());
        }
        routing.jobs.push(JobSpec::respond(agent.id.clone(), message, JobMode::Reply, Vec::new()));
    }
    routing
}

/// §7-2: エージェントの返答 reply（job から生まれた）。returnTo の相手には必ず return ジョブを積み
/// （その相手へのメンションは返却とみなす）、それ以外のメンションは新しい相談にする
pub fn route_reply(reply: &Message, job: &JobSpec, ctx: &RoutingContext<'_>) -> Routing {
    let mut routing = Routing::default();
    let Some(author) = reply.author_id.agent_id() else {
        return routing;
    };
    if !reply.kind.is_routable() {
        return routing;
    }
    for caller in targets::returnable(job, author, ctx) {
        routing.jobs.push(JobSpec::respond(caller.id.clone(), reply, JobMode::Return, Vec::new()));
    }
    for id in reply.mentions.iter().filter(|id| *id != author && !job.return_to.contains(id)) {
        targets::consult(&mut routing, id, author, reply, ctx);
    }
    limit_depth(routing, reply.depth)
}

/// §7-3: returnTo を持つジョブが返答なしで終わったら、注記つきで呼び出し元に戻す
pub fn route_no_answer(job: &JobSpec, author: &Agent, reason: NoAnswer, ctx: &RoutingContext<'_>) -> Routing {
    let note = match reason {
        NoAnswer::Passed => notices::did_not_answer(&author.name),
        NoAnswer::Failed => notices::failed(&author.name),
    };
    let jobs = targets::returnable(job, &author.id, ctx)
        .into_iter()
        .map(|caller| JobSpec {
            agent_id: caller.id.clone(),
            channel_id: job.channel_id.clone(),
            mode: JobMode::Return,
            triggers: Vec::new(),
            return_to: Vec::new(),
            depth: job.depth + 1,
            root_id: job.root_id.clone(),
            notes: vec![note.clone()],
            subtask: None,
            report: None,
        })
        .collect();
    limit_depth(Routing { jobs, ..Routing::default() }, job.depth)
}

/// depth が上限に達していたら振り分けず、上限のお知らせだけにする（振り分けるものがなければ何もしない）
fn limit_depth(routing: Routing, depth: u32) -> Routing {
    if depth >= MAX_DEPTH && !routing.jobs.is_empty() {
        Routing {
            notices: vec![Notice::DepthLimit],
            ..Routing::default()
        }
    } else {
        routing
    }
}
