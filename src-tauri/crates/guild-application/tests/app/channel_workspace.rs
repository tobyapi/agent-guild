//! 旧チャンネルでも作業場所・メモ・権限はエージェント共通。
use crate::support::runtime::reply;
use crate::support::TestApp;

#[tokio::test]
async fn channels_use_shared_workspace_and_memory_without_narrowing_role_permissions() {
    let app = TestApp::new();
    let agent = app.agent("worker", "ハル");
    let channel = app.channel("作業", &[&agent]);
    *app.workspace.memory.lock() = "SHARED_MEMORY".to_owned();
    app.runtime.script(agent.id.as_str(), reply("done"));
    app.services.conversation.send_human_message(&channel.id, "@ハル TASK", &[]).unwrap();
    app.settle().await;
    let requests = app.runtime.requests_for(agent.id.as_str());
    assert_eq!(requests.len(), 1);
    let request = &requests[0];
    let root = std::path::PathBuf::from("/ws").join(agent.id.as_str());
    assert_eq!(request.workspace, root.join("work"));
    assert_eq!(request.state_dir, root.join("state").join(&agent.backend));
    assert!(request.system_prompt.contains("SHARED_MEMORY"));
    assert_eq!(request.permissions, agent.behavior().permissions);
    assert!(request.prompt.contains("TASK"));
}

#[tokio::test]
async fn legacy_history_cutoff_stays_in_effect() {
    let app = TestApp::new();
    let agent = app.agent("worker", "ハル");
    let channel = app.channel("作業", &[&agent]);
    app.services.conversation.send_human_message(&channel.id, "OLD_PRIVATE_TASK", &[]).unwrap();
    app.settle().await;
    let old_seq = app.store.messages.lock().last().unwrap().seq;
    {
        let mut channels = app.store.channels.lock();
        let stored = channels.iter_mut().find(|c| c.id == channel.id).unwrap();
        stored.history_after_seq = old_seq;
        stored.guard_old_roots = true;
    }
    app.runtime.script(agent.id.as_str(), reply("done"));
    app.services.conversation.send_human_message(&channel.id, "@ハル NEW_TASK", &[]).unwrap();
    app.settle().await;
    let requests = app.runtime.requests_for(agent.id.as_str());
    let request = requests.last().unwrap();
    assert!(request.prompt.contains("NEW_TASK"));
    assert!(!request.prompt.contains("OLD_PRIVATE_TASK"));
}
