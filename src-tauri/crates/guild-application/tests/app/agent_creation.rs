use crate::support::runtime::{reply, Script};
use crate::support::{input, TestApp};
use guild_domain::author::MemberId;

fn request(json: &str) -> String {
    format!("Requested.\n\n```create-agent\n{json}\n```")
}
const JSON: &str = r#"{"requestId":"task-1","name":"NewAgent","template":"expert","backend":"claude"}"#;

#[tokio::test]
async fn manager_creation_saves_lists_membership_defaults_and_provenance_once() {
    let app = TestApp::new();
    let manager = app.agent("manager", "Manager");
    let channel = app.channel("work", &[&manager]);
    app.runtime.script(manager.id.as_str(), reply(&request(JSON)));
    app.services.conversation.send_human_message(&channel.id, "@Manager create", &[]).unwrap();
    app.settle().await;
    let new = app.store.agents.lock().iter().find(|a| a.name == "NewAgent").unwrap().clone();
    assert!(!new.autonomy_enabled);
    assert!(app.services.snapshot.get().unwrap().agents.iter().any(|a| a.id == new.id));
    assert!(app
        .store
        .channels
        .lock()
        .iter()
        .find(|c| c.id == channel.id)
        .unwrap()
        .has_member(&MemberId::Agent(new.id.clone())));
    assert!(app.store.skills.lock().iter().any(|s| s.agent_id == new.id && s.name == "universal-critique"));
    assert_eq!(app.store.creations.lock().len(), 1);
    assert_eq!(app.store.creations.lock()[0].0, manager.id);
    assert!(app.transcript(&channel).join("\n").contains("Agent registered: NewAgent"));
    assert!(app.events.state_changes.load(std::sync::atomic::Ordering::SeqCst) > 0);
    let restarted = app.restart();
    restarted.runtime.script(manager.id.as_str(), reply(&request(&JSON.replace("NewAgent", "DifferentName"))));
    restarted.services.conversation.send_human_message(&channel.id, "@Manager retry", &[]).unwrap();
    restarted.settle().await;
    assert_eq!(app.store.agents.lock().len(), 2);
    assert_eq!(app.store.creations.lock().len(), 1);
}

#[tokio::test]
async fn creation_rejects_nonmanagers_even_with_manager_self_claims() {
    for role in ["worker", "expert", "ideator"] {
        let app = TestApp::new();
        let mut data = input(role, "Actor");
        data.role = "manager".into();
        data.can_delegate = true;
        let agent = app.services.agents.create(data).unwrap();
        let channel = app.channel("work", &[&agent]);
        app.runtime.script(agent.id.as_str(), reply(&request(JSON)));
        app.services.conversation.send_human_message(&channel.id, "@Actor create", &[]).unwrap();
        app.settle().await;
        assert_eq!(app.store.agents.lock().len(), 1);
        assert_eq!(app.store.creation_audit.lock()[0].1, "manager_required");
        assert!(!app.runtime.requests_for(agent.id.as_str())[0].system_prompt.contains("## Creating an agent"));
    }
}

#[tokio::test]
async fn creation_invalid_input_or_identity_claims_leave_no_registration() {
    for json in [
        JSON.replace("expert", "manager"),
        JSON.replace("NewAgent", "bad name"),
        JSON.replace("NewAgent", "bad@name"),
        JSON.replace("NewAgent", "Manager"),
        JSON.replace("claude", "unknown"),
        JSON.replace("\"name\":", "\"model\":\"unknown\",\"name\":"),
        JSON.replace("\"name\":", "\"actorId\":\"forged-manager\",\"name\":"),
        JSON.replace("\"name\":", "\"permissions\":{},\"name\":"),
        JSON.replace("\"name\":", "\"unknown\":true,\"name\":"),
        "{invalid".into(),
        "x".repeat(8193),
    ] {
        let app = TestApp::new();
        let manager = app.agent("manager", "Manager");
        let channel = app.channel("work", &[&manager]);
        app.runtime.script(manager.id.as_str(), reply(&request(&json)));
        app.services.conversation.send_human_message(&channel.id, "create", &[]).unwrap();
        app.settle().await;
        assert_eq!(app.store.agents.lock().len(), 1, "{json}");
        assert!(app.store.creations.lock().is_empty());
        assert_ne!(app.store.creation_audit.lock()[0].1, "accepted");
    }
}

#[tokio::test]
async fn creation_ignores_human_history_progress_quotes_failed_and_pass_outputs() {
    let app = TestApp::new();
    let manager = app.agent("manager", "Manager");
    let channel = app.channel("work", &[&manager]);
    let command = request(JSON);
    for script in [
        Script::Posts(vec![command.clone()], "Normal reply".into()),
        reply(&format!("````text\n{command}\n````")),
        Script::Fail(command.clone()),
        reply("[PASS]"),
    ] {
        app.runtime.script(manager.id.as_str(), script);
        app.services.conversation.send_human_message(&channel.id, &command, &[]).unwrap();
        app.settle().await;
    }
    app.services.conversation.list_messages(&channel.id, None, None).unwrap();
    assert_eq!(app.store.agents.lock().len(), 1);
    assert!(app.store.creations.lock().is_empty());
    assert!(app.store.creation_audit.lock().is_empty());
}

#[tokio::test]
async fn creation_rechecks_role_after_running_job_and_preserves_human_creation() {
    use std::sync::Arc;
    use tokio::sync::Notify;
    let app = TestApp::new();
    let manager = app.agent("manager", "Manager");
    let channel = app.channel("work", &[&manager]);
    let gate = Arc::new(Notify::new());
    app.runtime.script(manager.id.as_str(), Script::Gate(gate.clone(), request(JSON)));
    app.services.conversation.send_human_message(&channel.id, "create", &[]).unwrap();
    while app.runtime.requests.lock().is_empty() {
        tokio::task::yield_now().await;
    }
    app.services.agents.update(&manager.id, input("worker", "Manager")).unwrap();
    gate.notify_one();
    app.settle().await;
    assert!(app.store.creations.lock().is_empty());
    // The unchanged human API can still appoint a manager.
    assert!(app.services.agents.create(input("manager", "HumanAppointed")).is_ok());
}

#[tokio::test]
async fn creation_coexists_with_notification_and_skill_footer() {
    let app = TestApp::new();
    let manager = app.agent("manager", "Manager");
    app.notifications.set_enabled(true).unwrap();
    let channel = app.channel("work", &[&manager]);
    let raw = format!("{}\n\n```notify\nReady\n```\n\n```skill-usage\n[\"clean-code\"]\n```", request(JSON));
    app.runtime.script(manager.id.as_str(), reply(&raw));
    app.services.conversation.send_human_message(&channel.id, "create", &[]).unwrap();
    app.settle().await;
    assert_eq!(app.store.agents.lock().len(), 2);
    assert_eq!(app.notifier.calls.lock().len(), 1);
    assert_eq!(app.messages(&channel)[1].skill_usage.as_ref().unwrap().declared, vec!["clean-code"]);
    assert_eq!(app.messages(&channel)[1].content, "Requested.");
}

#[tokio::test]
async fn creation_requires_a_saved_uncancelled_final_reply() {
    use std::sync::Arc;
    use tokio::sync::Notify;
    let app = TestApp::new();
    let manager = app.agent("manager", "Manager");
    let channel = app.channel("work", &[&manager]);
    *app.store.reject_next_final.lock() = true;
    app.runtime.script(manager.id.as_str(), reply(&request(JSON)));
    app.services.conversation.send_human_message(&channel.id, "create", &[]).unwrap();
    app.settle().await;
    assert!(app.store.creations.lock().is_empty());
    let gate = Arc::new(Notify::new());
    app.runtime.script(manager.id.as_str(), Script::Gate(gate.clone(), request(JSON)));
    app.services.conversation.send_human_message(&channel.id, "create", &[]).unwrap();
    while app.runtime.requests.lock().len() < 2 {
        tokio::task::yield_now().await;
    }
    app.services.conversation.stop(&channel.id).await.unwrap();
    gate.notify_one();
    app.settle().await;
    assert_eq!(app.store.agents.lock().len(), 1);
    assert!(app.store.creations.lock().is_empty());
}
