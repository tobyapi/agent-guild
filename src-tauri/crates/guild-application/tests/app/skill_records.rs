use crate::support::{runtime::Script, TestApp};
use guild_application::ports::RunUpdate;
use guild_domain::author::Author;

fn read(name: &str) -> RunUpdate {
    RunUpdate::SkillObservation(Some(name.into()))
}
fn post(text: &str) -> RunUpdate {
    RunUpdate::Post(text.into())
}

#[tokio::test]
async fn progress_and_final_metadata_stay_with_each_author_and_run() {
    let app = TestApp::new();
    let a = app.agent("worker", "Alpha");
    let b = app.agent("worker", "Beta");
    let channel = app.channel("skills", &[&a, &b]);
    for (agent, skill) in [(&a, "alpha"), (&b, "beta")] {
        app.runtime.script(
            agent.id.as_str(),
            Script::Updates(
                vec![
                    RunUpdate::SkillObservation(None),
                    read(skill),
                    read(skill),
                    post("[PASS]"),
                    post("progress"),
                    read("final"),
                ],
                "reply".into(),
            ),
        );
    }
    app.services.conversation.send_human_message(&channel.id, "@Alpha @Beta work", &[]).unwrap();
    app.settle().await;
    let messages = app.messages(&channel);
    for (agent, skill) in [(&a, "alpha"), (&b, "beta")] {
        let authored: Vec<_> = messages.iter().filter(|m| m.author_id == Author::Agent(agent.id.clone())).collect();
        assert_eq!(authored.len(), 2);
        let progress = authored[0].skill_usage.as_ref().unwrap();
        let final_usage = authored[1].skill_usage.as_ref().unwrap();
        assert_eq!(progress.loaded, [skill]);
        assert_eq!(final_usage.loaded, ["final"]);
        assert_eq!(progress.run_id, final_usage.run_id);
        assert_eq!(progress.interval.as_ref().unwrap().agent_id, agent.id.as_str());
        assert_eq!((progress.interval.as_ref().unwrap().start, progress.interval.as_ref().unwrap().end), (0, 2));
        assert_eq!((final_usage.interval.as_ref().unwrap().start, final_usage.interval.as_ref().unwrap().end), (2, 3));
    }
    let runs: std::collections::HashSet<_> =
        messages.iter().filter_map(|m| m.skill_usage.as_ref()?.run_id.as_ref()).collect();
    assert_eq!(runs.len(), 2);
}

#[tokio::test]
async fn actual_repository_failure_does_not_attach_failed_interval_to_next_message() {
    let app = TestApp::new();
    let agent = app.agent("worker", "Worker");
    let channel = app.channel("skills", &[&agent]);
    *app.store.reject_next_progress.lock() = true;
    app.runtime.script(
        agent.id.as_str(),
        Script::Updates(
            vec![read("failed-window"), post("failed progress"), read("next-window"), post("saved progress")],
            "final".into(),
        ),
    );
    app.services.conversation.send_human_message(&channel.id, "@Worker work", &[]).unwrap();
    app.settle().await;
    let messages = app.messages(&channel);
    assert_eq!(messages.len(), 3);
    assert_eq!(messages[1].content, "saved progress");
    let usage = messages[1].skill_usage.as_ref().unwrap();
    assert_eq!(usage.loaded, ["next-window"]);
    assert_eq!(usage.interval.as_ref().unwrap().start, 1);
    assert!(messages[2].skill_usage.as_ref().unwrap().loaded.is_empty());
}
