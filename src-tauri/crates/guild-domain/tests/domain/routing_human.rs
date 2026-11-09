//! 振り分け §7-1: 人間の発言。

use guild_domain::agent::{Agent, UnmentionedPolicy};
use guild_domain::author::Author;
use guild_domain::channel::Channel;
use guild_domain::conversation::{route_human_message, JobMode, Notice, Routing, RoutingContext};
use guild_domain::ids::{AgentId, MessageId};
use guild_domain::message::{Message, MessageKind};

use super::support::{agent_at, channel, ids, message};

fn agents() -> Vec<Agent> {
    let mut codex_worker = agent_at("sora", "worker", "ソラ", 1);
    codex_worker.backend = "codex".to_owned();
    vec![
        agent_at("haru2", "worker", "ハル2", 3),
        codex_worker,
        agent_at("haru", "worker", "ハル", 2),
        agent_at("logica", "expert", "ロジカ", 0),
        agent_at("kai", "worker", "カイ", 4),
    ]
}

fn route(message: &Message, channel: &Channel, ready: &[&str]) -> Routing {
    let agents = agents();
    let ready: Vec<String> = ready.iter().map(|b| (*b).to_owned()).collect();
    let ctx = RoutingContext { channel, agents: &agents, ready_backends: &ready };
    route_human_message(message, &ctx)
}

fn targets(routing: &Routing) -> Vec<AgentId> {
    routing.jobs.iter().map(|job| job.agent_id.clone()).collect()
}

#[test]
fn unmentioned_message_goes_to_every_ready_worker_in_creation_order() {
    let lobby = channel("c1", &["me", "haru2", "logica", "haru", "sora"]);
    let routing = route(&message(1, Author::Human, "こんにちは"), &lobby, &["claude", "codex"]);
    assert_eq!(targets(&routing), ids(&["sora", "haru", "haru2"]));
    assert!(routing.joins.is_empty() && routing.notices.is_empty());
    let job = &routing.jobs[0];
    assert_eq!((job.mode, job.depth, job.return_to.len()), (JobMode::Reply, 1, 0));
    assert_eq!(job.root_id, Some(MessageId::new("m1")));
}

#[test]
fn workers_whose_backend_is_not_ready_do_not_answer() {
    let lobby = channel("c1", &["me", "haru", "sora", "logica"]);
    let routing = route(&message(1, Author::Human, "こんにちは"), &lobby, &["claude"]);
    assert_eq!(targets(&routing), ids(&["haru"]));
}

#[test]
fn experts_answer_only_when_no_worker_can() {
    let experts_only = channel("c1", &["me", "logica"]);
    let routing = route(&message(1, Author::Human, "相談です"), &experts_only, &["claude"]);
    assert_eq!(targets(&routing), ids(&["logica"]));

    let codex_worker_only = channel("c2", &["me", "sora", "logica"]);
    let routing = route(&message(1, Author::Human, "相談です"), &codex_worker_only, &["claude"]);
    assert_eq!(targets(&routing), ids(&["logica"]), "answer の人が答えられなければ fallback の人");
}

#[test]
fn says_so_when_nobody_can_answer() {
    let lobby = channel("c1", &["me", "haru"]);
    let routing = route(&message(1, Author::Human, "こんにちは"), &lobby, &[]);
    assert!(routing.jobs.is_empty());
    assert_eq!(routing.notices, vec![Notice::NoResponder]);
}

#[test]
fn mentioned_agents_answer_and_outsiders_join_whatever_their_settings() {
    let lobby = channel("c1", &["me", "haru", "logica"]);
    let mut asked = message(1, Author::Human, "@ロジカ @カイ 見て");
    asked.mentions = ids(&["logica", "kai"]);
    let routing = route(&asked, &lobby, &["claude"]);
    assert_eq!(targets(&routing), ids(&["logica", "kai"]));
    assert_eq!(routing.joins, ids(&["kai"]));
}

#[test]
fn deleted_agents_are_not_called() {
    let lobby = channel("c1", &["me", "haru"]);
    let mut asked = message(1, Author::Human, "@ハル");
    asked.mentions = ids(&["haru", "nobody"]);
    let mut agents = agents();
    agents.iter_mut().filter(|a| a.id.as_str() == "haru").for_each(|a| a.deleted_at = Some(1));
    let ready = vec!["claude".to_owned()];
    let ctx = RoutingContext { channel: &lobby, agents: &agents, ready_backends: &ready };
    assert!(route_human_message(&asked, &ctx).jobs.is_empty());
}

#[test]
fn system_and_error_messages_are_not_routed() {
    let lobby = channel("c1", &["me", "haru"]);
    for kind in [MessageKind::System, MessageKind::Error] {
        let mut notice = message(1, Author::System, "お知らせ");
        notice.kind = kind;
        assert_eq!(route(&notice, &lobby, &["claude"]), Routing::default());
    }
}

#[test]
fn agents_set_to_ignore_never_answer_unmentioned_messages() {
    let mut quiet = agents();
    for agent in &mut quiet {
        let speaks = agent.id.as_str() == "logica";
        agent.unmentioned = if speaks { UnmentionedPolicy::Answer } else { UnmentionedPolicy::Ignore };
    }
    let lobby = channel("c1", &["me", "haru", "logica"]);
    let ready = vec!["claude".to_owned()];
    let hello = message(1, Author::Human, "こんにちは");
    let ctx = RoutingContext { channel: &lobby, agents: &quiet, ready_backends: &ready };
    assert_eq!(targets(&route_human_message(&hello, &ctx)), ids(&["logica"]), "設定がすべて（テンプレートは関係ない）");

    quiet.iter_mut().for_each(|agent| agent.unmentioned = UnmentionedPolicy::Ignore);
    let ctx = RoutingContext { channel: &lobby, agents: &quiet, ready_backends: &ready };
    assert_eq!(route_human_message(&hello, &ctx).notices, vec![Notice::NoResponder]);
}

#[test]
fn leads_take_unmentioned_messages_before_everyone_else() {
    let mut agents = agents();
    agents.push(agent_at("kaname", "manager", "カナメ", 9));
    agents.push(agent_at("mio", "manager", "ミオ", 8));
    let lobby = channel("c1", &["me", "haru", "logica", "kaname", "mio"]);
    let ready = vec!["claude".to_owned()];
    let hello = message(1, Author::Human, "まとめてお願い");
    let ctx = RoutingContext { channel: &lobby, agents: &agents, ready_backends: &ready };
    assert_eq!(targets(&route_human_message(&hello, &ctx)), ids(&["mio", "kaname"]), "lead の全員（作成順）だけ");

    agents
        .iter_mut()
        .filter(|a| a.id.as_str() == "mio" || a.id.as_str() == "kaname")
        .for_each(|a| a.backend = "codex".to_owned());
    let ctx = RoutingContext { channel: &lobby, agents: &agents, ready_backends: &ready };
    assert_eq!(targets(&route_human_message(&hello, &ctx)), ids(&["haru"]), "ready な lead がいなければ answer の段");
}
