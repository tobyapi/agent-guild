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
    let app = TestApp::new();
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
    app.services.conversation.send_human_message(&channel.id, "@Worker work", &[]).unwrap();
    for _ in 0..100 {
        if app.messages(&channel).len() == 2 {
            break;
        }
        tokio::time::sleep(Duration::from_millis(1)).await;
    }
    let saved = app.messages(&channel)[1].clone();
    let conversation = app.services.conversation.clone();
    let channel_id = channel.id.clone();
    let stop = tokio::spawn(async move { conversation.stop(&channel_id).await });
    for _ in 0..100 {
        if !app.runtime.cancelled.lock().is_empty() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(1)).await;
    }
    assert!(app.services.conversation.skill_record_truncated(&saved.id).unwrap());
    gate.notify_one();
    stop.await.unwrap().unwrap();
    app.settle().await;
    let messages = app.messages(&channel);
    assert_eq!(messages[1], saved);
    assert!(!messages.iter().any(|message| message.content == "late" || message.content == "late final"));
    let restarted = app.restart();
    assert!(restarted.services.conversation.skill_record_truncated(&saved.id).unwrap());
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
