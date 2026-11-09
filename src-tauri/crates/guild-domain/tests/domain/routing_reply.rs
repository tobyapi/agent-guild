//! 振り分け §7-2・§7-3: エージェントの返答と、返答がなかったとき。

use guild_domain::agent::Agent;
use guild_domain::conversation::{
    route_no_answer, route_reply, JobMode, JobSpec, NoAnswer, Notice, Routing, RoutingContext, MAX_DEPTH,
};
use guild_domain::ids::{AgentId, MessageId};
use guild_domain::message::Message;

use super::support::{agent, by, channel, ids, message};

fn agents() -> Vec<Agent> {
    let mut ghost = agent("ghost", "worker", "ゴースト");
    ghost.deleted_at = Some(1);
    vec![
        agent("haru", "worker", "ハル"),
        agent("sora", "worker", "ソラ"),
        agent("logica", "expert", "ロジカ"),
        agent("gear", "expert", "ギア"),
        agent("kai", "worker", "カイ"),
        ghost,
    ]
}

/// author の返答（depth・メンション・起点 m1）と、それを生んだジョブ（returnTo）
fn reply(author: &str, depth: u32, mentions: &[&str], return_to: &[&str]) -> (Message, JobSpec) {
    let mut message = message(10, by(author), "返答");
    message.depth = depth;
    message.mentions = ids(mentions);
    message.root_id = MessageId::new("m1");
    let mut job = JobSpec::respond(AgentId::new(author), &message, JobMode::Reply, ids(return_to));
    job.depth = depth;
    (message, job)
}

fn route(message: &Message, job: &JobSpec) -> Routing {
    let lobby = channel("c1", &["me", "haru", "sora", "logica", "ghost"]);
    let agents = agents();
    let ctx = RoutingContext { channel: &lobby, agents: &agents, ready_backends: &[] };
    route_reply(message, job, &ctx)
}

fn summary(routing: &Routing) -> Vec<(String, JobMode, Vec<AgentId>)> {
    let describe = |job: &JobSpec| (job.agent_id.to_string(), job.mode, job.return_to.clone());
    routing.jobs.iter().map(describe).collect()
}

#[test]
fn a_mention_starts_a_consultation_that_returns_to_the_author() {
    let (message, job) = reply("haru", 1, &["logica"], &[]);
    let routing = route(&message, &job);
    assert_eq!(summary(&routing), vec![("logica".to_owned(), JobMode::Reply, ids(&["haru"]))]);
    assert_eq!((routing.jobs[0].depth, routing.jobs[0].root_id.clone()), (2, Some(MessageId::new("m1"))));
}

#[test]
fn only_consultable_outsiders_join() {
    let (message, job) = reply("haru", 1, &["gear", "kai"], &[]);
    let routing = route(&message, &job);
    assert_eq!(summary(&routing), vec![("gear".to_owned(), JobMode::Reply, ids(&["haru"]))]);
    assert_eq!(routing.joins, ids(&["gear"]));
    assert_eq!(routing.notices, vec![Notice::Undeliverable("カイ".to_owned())]);
}

#[test]
fn the_answer_always_returns_to_the_caller() {
    let (message, job) = reply("logica", 2, &[], &["haru"]);
    assert_eq!(summary(&route(&message, &job)), vec![("haru".to_owned(), JobMode::Return, vec![])]);
}

#[test]
fn mentioning_the_caller_is_a_return_not_a_new_consultation() {
    let (message, job) = reply("logica", 2, &["haru"], &["haru"]);
    assert_eq!(summary(&route(&message, &job)), vec![("haru".to_owned(), JobMode::Return, vec![])]);
}

#[test]
fn other_mentions_in_an_answer_become_new_consultations() {
    let (message, job) = reply("logica", 2, &["sora"], &["haru"]);
    assert_eq!(
        summary(&route(&message, &job)),
        vec![
            ("haru".to_owned(), JobMode::Return, vec![]),
            ("sora".to_owned(), JobMode::Reply, ids(&["logica"])),
        ]
    );
}

#[test]
fn returns_skip_the_author_deleted_agents_and_non_members() {
    let (message, job) = reply("logica", 2, &["logica"], &["logica", "ghost", "gear"]);
    assert_eq!(route(&message, &job), Routing::default());
}

#[test]
fn stops_at_the_depth_limit_with_a_notice() {
    let (message, job) = reply("logica", MAX_DEPTH, &[], &["haru"]);
    let routing = route(&message, &job);
    assert!(routing.jobs.is_empty());
    assert_eq!(routing.notices, vec![Notice::DepthLimit]);

    let (message, job) = reply("logica", MAX_DEPTH - 1, &[], &["haru"]);
    assert_eq!(route(&message, &job).jobs[0].depth, MAX_DEPTH);

    let (quiet, job) = reply("haru", MAX_DEPTH, &[], &[]);
    assert_eq!(route(&quiet, &job), Routing::default(), "振り分けるものがなければ知らせない");
}

#[test]
fn no_answer_returns_to_callers_with_a_note() {
    let (_, job) = reply("logica", 2, &[], &["haru"]);
    let logica = agent("logica", "expert", "ロジカ");
    let lobby = channel("c1", &["me", "haru", "logica"]);
    let agents = agents();
    let ctx = RoutingContext { channel: &lobby, agents: &agents, ready_backends: &[] };
    let passed = route_no_answer(&job, &logica, NoAnswer::Passed, &ctx);
    assert_eq!(summary(&passed), vec![("haru".to_owned(), JobMode::Return, vec![])]);
    assert_eq!(passed.jobs[0].notes, vec!["ロジカ は回答しませんでした".to_owned()]);
    assert!(passed.jobs[0].triggers.is_empty());
    assert_eq!(passed.jobs[0].depth, 3);
    let failed = route_no_answer(&job, &logica, NoAnswer::Failed, &ctx);
    assert_eq!(failed.jobs[0].notes, vec!["ロジカ は失敗しました".to_owned()]);

    let (_, plain) = reply("haru", 1, &[], &[]);
    assert_eq!(route_no_answer(&plain, &logica, NoAnswer::Failed, &ctx), Routing::default());
}

#[test]
fn consultability_is_a_setting_of_each_agent() {
    let (message, job) = reply("haru", 1, &["kai"], &[]);
    let lobby = channel("c1", &["me", "haru"]);
    let mut agents = agents();
    agents.iter_mut().filter(|a| a.id.as_str() == "kai").for_each(|a| a.consultable = true);
    let ctx = RoutingContext { channel: &lobby, agents: &agents, ready_backends: &[] };
    let routing = route_reply(&message, &job, &ctx);
    assert_eq!(routing.joins, ids(&["kai"]), "consultable なら作業者テンプレートの人でも参加する");
}
