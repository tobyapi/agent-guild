use std::sync::Arc;
use std::time::Duration;

use guild_application::ports::RunUpdate;
use guild_domain::author::Author;
use tokio::sync::Notify;

use crate::support::{runtime::Script, TestApp};

fn read(name: &str, sequence: u64) -> RunUpdate {
    RunUpdate::SkillRead(name.into(), "backend:shared".into(), sequence)
}
fn post(text: &str) -> RunUpdate {
    RunUpdate::Post(text.into())
}

#[tokio::test]
async fn structured_reads_after_failed_save_do_not_leak_or_lose_reused_call_ids() {
    let app = TestApp::new();
    let agent = app.agent("worker", "Worker");
    let channel = app.channel("skills", &[&agent]);
    *app.store.reject_next_progress.lock() = true;
    app.runtime.script(
        agent.id.as_str(),
        Script::Updates(
            vec![read("failed", 1), post("failed"), read("saved", 2), read("saved", 2), post("saved")],
            "final".into(),
        ),
    );
    app.services.conversation.send_human_message(&channel.id, "@Worker work", &[]).unwrap();
    app.settle().await;
    let messages = app.messages(&channel);
    assert_eq!(messages.len(), 3);
    let usage = messages[1].skill_usage.as_ref().unwrap();
    assert_eq!(usage.loaded, ["saved"]);
    let interval = usage.interval.as_ref().unwrap();
    assert!(!interval.incomplete);
    assert_eq!((interval.start, interval.end), (1, 2));
    assert_eq!(interval.observations.len(), 1);
    assert!(messages[2].skill_usage.as_ref().unwrap().loaded.is_empty());
}

#[tokio::test]
async fn cancellation_persists_job_cutoff_without_changing_saved_progress() {
    check_cancellation(false).await;
}

#[tokio::test]
async fn cutoff_save_failure_still_cancels_and_discards_late_results_without_changing_saved_posts() {
    check_cancellation(true).await;
}

async fn wait_until(mut ready: impl FnMut() -> bool) {
    let result = tokio::time::timeout(Duration::from_secs(2), async {
        while !ready() {
            tokio::time::sleep(Duration::from_millis(1)).await;
        }
    })
    .await;
    assert!(result.is_ok(), "expected state was not reached");
}

fn assert_cutoff(app: &TestApp, message: &guild_domain::ids::MessageId, expected: bool) {
    let actual = app.services.conversation.skill_record_truncated(message).unwrap_or_else(|error| panic!("{error}"));
    assert_eq!(actual, expected);
}

async fn check_cancellation(reject_cutoff: bool) {
    let app = TestApp::new();
    *app.store.reject_next_cutoff.lock() = reject_cutoff;
    let agent = app.agent("worker", "Worker");
    let channel = app.channel("skills", &[&agent]);
    let gate = Arc::new(Notify::new());
    app.runtime.script(
        agent.id.as_str(),
        Script::PhasedUpdates(
            vec![read("saved", 1), post("saved"), read("unsaved", 2)],
            gate.clone(),
            vec![read("late", 3), post("late")],
        ),
    );
    assert!(app.services.conversation.send_human_message(&channel.id, "@Worker work", &[]).is_ok());
    wait_until(|| app.messages(&channel).len() == 2).await;
    let before = app.messages(&channel);
    assert_eq!(before.len(), 2, "progress must be saved before cancellation");
    let saved = &before[1];
    let conversation = app.services.conversation.clone();
    let channel_id = channel.id.clone();
    let stop = tokio::spawn(async move { conversation.stop(&channel_id).await });
    wait_until(|| !app.runtime.cancelled.lock().is_empty()).await;
    let job_id = app.runtime.requests.lock()[0].0.clone();
    assert_eq!(*app.runtime.cancelled.lock(), [job_id]);
    assert!(!*app.store.reject_next_cutoff.lock(), "truncate failure injection must be consumed");
    assert_cutoff(&app, &saved.id, !reject_cutoff);
    assert_eq!(app.store.skill_cutoffs.lock().len(), usize::from(!reject_cutoff));
    gate.notify_one();
    assert!(matches!(tokio::time::timeout(Duration::from_secs(2), stop).await, Ok(Ok(Ok(())))));
    app.settle().await;
    let messages = app.messages(&channel);
    assert_eq!(&messages[..before.len()], before.as_slice());
    assert_eq!(app.transcript(&channel), ["人間: @Worker work", "Worker: saved", "システム: 停止しました"]);
    let restarted = app.restart();
    assert_cutoff(&restarted, &saved.id, !reject_cutoff);
}

#[tokio::test]
async fn delegated_children_and_manager_summary_keep_separate_structured_records() {
    let app = TestApp::new();
    let manager = app.agent("manager", "Manager");
    let a = app.agent("worker", "Alpha");
    let b = app.agent("worker", "Beta");
    let channel = app.channel("skills", &[&manager, &a, &b]);
    app.runtime.script(
        manager.id.as_str(),
        Script::Updates(vec![read("parent", 1)], "```tasks\n@Alpha: work\n@Beta: work\n```".into()),
    );
    app.runtime.script(manager.id.as_str(), Script::Updates(vec![read("summary", 1)], "summary".into()));
    for (agent, skill) in [(&a, "alpha"), (&b, "beta")] {
        app.runtime.script(
            agent.id.as_str(),
            Script::Updates(vec![read(skill, 1), post("progress"), read(skill, 2)], "reply".into()),
        );
    }
    app.services.conversation.send_human_message(&channel.id, "@Manager work", &[]).unwrap();
    app.settle().await;
    let messages = app.messages(&channel);
    let mut runs = std::collections::HashSet::new();
    for (agent, expected) in [(&manager, "parent"), (&a, "alpha"), (&b, "beta")] {
        let authored: Vec<_> = messages.iter().filter(|m| m.author_id == Author::Agent(agent.id.clone())).collect();
        assert_eq!(authored.len(), 2);
        for message in authored {
            let usage = message.skill_usage.as_ref().unwrap();
            let name = if message.content == "summary" { "summary" } else { expected };
            assert_eq!(usage.loaded, [name]);
            assert_eq!(usage.interval.as_ref().unwrap().agent_id, agent.id.as_str());
            assert!(!usage.interval.as_ref().unwrap().incomplete);
            runs.insert(usage.run_id.clone().unwrap());
        }
    }
    assert_eq!(runs.len(), 4);
}
