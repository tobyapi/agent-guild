//! レーンでの合流規則と、ジョブが関わる会話の判定（design.md §6）。

use guild_domain::author::Author;
use guild_domain::conversation::{JobMode, JobSpec};
use guild_domain::ids::{AgentId, ChannelId, MessageId};

use super::support::{by, ids, message};

fn reply_to(seq: i64, depth: u32, return_to: &[&str]) -> JobSpec {
    let mut trigger = message(seq, Author::Human, "依頼");
    trigger.depth = depth;
    JobSpec::respond(AgentId::new("haru"), &trigger, JobMode::Reply, ids(return_to))
}

#[test]
fn respond_derives_depth_and_root_from_the_trigger() {
    let mut trigger = message(5, by("logica"), "回答");
    trigger.depth = 2;
    trigger.root_id = MessageId::new("m1");
    let job = JobSpec::respond(AgentId::new("haru"), &trigger, JobMode::Return, Vec::new());
    assert_eq!(job.depth, 3);
    assert_eq!(job.root_id, Some(MessageId::new("m1")));
    assert_eq!(job.latest_trigger().map(|m| m.seq), Some(5));
}

#[test]
fn merging_unions_triggers_return_to_and_notes() {
    let mut pending = reply_to(3, 0, &["sora"]);
    pending.notes.push("ロジカ は回答しませんでした".to_owned());
    let mut incoming = reply_to(1, 2, &["sora", "gear"]);
    incoming.notes.push("ロジカ は回答しませんでした".to_owned());
    pending.merge(incoming);
    let seqs: Vec<i64> = pending.triggers.iter().map(|m| m.seq).collect();
    assert_eq!(seqs, vec![1, 3], "きっかけは seq 順");
    assert_eq!(pending.return_to, ids(&["sora", "gear"]));
    assert_eq!(pending.notes.len(), 1);
    assert_eq!(pending.depth, 3, "depth は大きい方");
}

#[test]
fn merging_keeps_the_strongest_mode() {
    let channel = ChannelId::new("c1");
    let mut pending = JobSpec::autonomous(AgentId::new("haru"), channel);
    let mut returned = reply_to(2, 1, &[]);
    returned.mode = JobMode::Return;
    pending.merge(returned);
    assert_eq!(pending.mode, JobMode::Return);
    assert_eq!(pending.root_id, Some(MessageId::new("m2")), "自発活動に起点が加わる");
    pending.merge(reply_to(3, 0, &[]));
    assert_eq!(pending.mode, JobMode::Reply);
    let mut later = reply_to(4, 0, &[]);
    later.mode = JobMode::Autonomous;
    pending.merge(later);
    assert_eq!(pending.mode, JobMode::Reply, "弱いモードでは上書きしない");
}

#[test]
fn merging_ignores_duplicate_triggers() {
    let mut pending = reply_to(2, 0, &[]);
    pending.merge(reply_to(2, 0, &[]));
    assert_eq!(pending.triggers.len(), 1);
}

#[test]
fn jobs_share_a_conversation_through_their_roots_or_triggers() {
    let first = reply_to(1, 0, &[]);
    let mut merged = reply_to(2, 0, &[]);
    merged.merge(reply_to(3, 0, &[]));
    assert!(!first.shares_conversation(&merged), "起点が違えば別の会話");
    merged.merge(reply_to(1, 0, &[]));
    assert!(
        first.shares_conversation(&merged) && merged.shares_conversation(&first),
        "合流したきっかけの会話にも関わる"
    );
    let idle = JobSpec::autonomous(AgentId::new("haru"), ChannelId::new("c1"));
    assert_eq!(idle.conversations().count(), 0, "自発活動は会話を持たない");
    assert!(!idle.shares_conversation(&first));
}

#[test]
fn only_jobs_of_the_same_agent_and_channel_merge() {
    let job = reply_to(1, 0, &[]);
    let mut other_agent = job.clone();
    other_agent.agent_id = AgentId::new("sora");
    let mut other_channel = job.clone();
    other_channel.channel_id = ChannelId::new("c2");
    assert!(job.can_merge(&job.clone()));
    assert!(!job.can_merge(&other_agent));
    assert!(!job.can_merge(&other_channel));
}
