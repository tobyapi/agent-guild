use crate::support::runtime::{ready_backend, reply, Script};
use crate::support::TestApp;
use guild_domain::channel::WorkspaceMode;

/// 割り当てるフォルダ（その OS の絶対パス。"/project" は Windows では絶対パスにならず、検証で落ちる）
const PROJECT: &str = if cfg!(windows) { r"C:\project" } else { "/project" };

#[tokio::test]
async fn scope_changes_separate_history_memory_state_and_restore_without_old_context() {
    let app = TestApp::new();
    let agent = ollama_worker(&app);
    let channel = app.channel("作業", &[&agent]);
    *app.workspace.memory.lock() = "LEGACY_PRIVATE_MEMORY".to_owned();
    app.runtime.script(agent.id.as_str(), reply("old answer"));
    app.services.conversation.send_human_message(&channel.id, "@ハル OLD_PRIVATE_TASK", &[]).unwrap();
    app.settle().await;
    let changed = app
        .services
        .conversation
        .configure_workspace(&channel.id, WorkspaceMode::Folder, Some(PROJECT.to_owned()))
        .await
        .unwrap();
    assert_eq!(changed.workspace.revision, 1);
    let unchanged = app
        .services
        .conversation
        .configure_workspace(&channel.id, WorkspaceMode::Folder, Some(PROJECT.to_owned()))
        .await
        .unwrap();
    assert_eq!(unchanged.workspace, changed.workspace);
    app.services.conversation.send_human_message(&channel.id, "@ハル NEW_TASK", &[]).unwrap();
    app.settle().await;
    let requests = app.runtime.requests_for(agent.id.as_str());
    let scoped = requests.last().unwrap();
    assert!(scoped.prompt.contains("NEW_TASK"));
    assert!(!scoped.prompt.contains("OLD_PRIVATE_TASK"));
    assert!(!scoped.system_prompt.contains("LEGACY_PRIVATE_MEMORY"));
    assert_eq!(scoped.writable_dirs.as_ref().unwrap(), &vec![std::path::PathBuf::from(PROJECT)]);
    assert!(scoped.permissions.read_files && scoped.permissions.write_files);
    assert_ne!(scoped.workspace, requests[0].workspace);
    assert_ne!(scoped.state_dir, requests[0].state_dir);
    assert!(
        !scoped.permissions.write_anywhere
            && !scoped.permissions.read_anywhere
            && !scoped.permissions.run_commands
            && !scoped.permissions.skills
    );
    app.services.conversation.configure_workspace(&channel.id, WorkspaceMode::Legacy, None).await.unwrap();
    app.services.conversation.send_human_message(&channel.id, "@ハル RESTORED_TASK", &[]).unwrap();
    app.settle().await;
    let requests = app.runtime.requests_for(agent.id.as_str());
    let restored = requests.last().unwrap();
    assert_ne!(restored.workspace, requests[0].workspace);
    assert_ne!(restored.workspace, scoped.workspace);
    assert!(!restored.prompt.contains("NEW_TASK"));
    assert!(!restored.system_prompt.contains("LEGACY_PRIVATE_MEMORY"));
    assert!(restored.writable_dirs.is_none());
}

#[tokio::test]
async fn scope_cannot_change_while_jobs_are_running() {
    let app = TestApp::new();
    let agent = ollama_worker(&app);
    let channel = app.channel("作業", &[&agent]);
    app.runtime.script(agent.id.as_str(), Script::Hang);
    app.services.conversation.send_human_message(&channel.id, "@ハル wait", &[]).unwrap();
    for _ in 0..100 {
        if !app.runtime.requests_for(agent.id.as_str()).is_empty() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(2)).await;
    }
    assert!(app
        .services
        .conversation
        .configure_workspace(&channel.id, WorkspaceMode::Folder, Some(PROJECT.to_owned()))
        .await
        .is_err());
    app.services.conversation.stop(&channel.id).await.unwrap();
    app.settle().await;
    assert!(app
        .services
        .conversation
        .configure_workspace(&channel.id, WorkspaceMode::Folder, Some(PROJECT.to_owned()))
        .await
        .is_ok());
}

#[tokio::test]
async fn unsupported_folder_backends_stop_before_runtime() {
    for backend in ["claude", "other"] {
        let app = TestApp::new();
        let mut agent = app.agent("worker", "ハル");
        agent.backend = backend.to_owned();
        app.store.agents.lock().iter_mut().find(|a| a.id == agent.id).unwrap().backend = agent.backend.clone();
        app.runtime.backends.lock().push(ready_backend(backend));
        let channel = app.channel("作業", &[&agent]);
        app.services
            .conversation
            .configure_workspace(&channel.id, WorkspaceMode::Folder, Some(PROJECT.to_owned()))
            .await
            .unwrap();
        app.services.conversation.send_human_message(&channel.id, "@ハル FILE_TASK", &[]).unwrap();
        app.settle().await;
        assert!(app.runtime.requests_for(agent.id.as_str()).is_empty(), "{backend}");
        let transcript = app.transcript(&channel).join("\n");
        assert!(
            transcript.contains(if backend == "claude" { "リンク差し替え" } else { "フォルダ制限" }),
            "{transcript}"
        );
    }
}

#[tokio::test]
async fn sandboxed_backends_keep_commands_inside_the_folder_scope() {
    for backend in ["codex", "grok", "muse"] {
        let app = TestApp::new();
        let mut agent = app.agent("worker", "ハル");
        agent.backend = backend.to_owned();
        app.store.agents.lock().iter_mut().find(|a| a.id == agent.id).unwrap().backend = agent.backend.clone();
        app.runtime.backends.lock().push(ready_backend(backend));
        let channel = app.channel("作業", &[&agent]);
        app.services
            .conversation
            .configure_workspace(&channel.id, WorkspaceMode::Folder, Some(PROJECT.to_owned()))
            .await
            .unwrap();
        app.runtime.script(agent.id.as_str(), reply("done"));
        app.services.conversation.send_human_message(&channel.id, "@ハル FILE_TASK", &[]).unwrap();
        app.settle().await;
        let requests = app.runtime.requests_for(agent.id.as_str());
        let scoped = requests.last().unwrap_or_else(|| panic!("{backend}: no request"));
        let project = std::path::PathBuf::from(PROJECT);
        assert_eq!(scoped.writable_dirs.as_ref().unwrap(), &vec![project.clone()], "{backend}");
        assert!(scoped.readable_dirs.contains(&project), "{backend}");
        // シェルごと隔離に入れるので、コマンドは残す。PC 全体の読み書きとスキルは外す
        let permissions = &scoped.permissions;
        assert!(permissions.run_commands && permissions.write_files, "{backend}");
        assert!(!permissions.read_anywhere && !permissions.write_anywhere && !permissions.skills, "{backend}");
        assert!(scoped.system_prompt.contains("コマンドはこの範囲の中でだけ動きます"), "{backend}");
    }
}

fn ollama_worker(app: &TestApp) -> guild_domain::agent::Agent {
    let mut agent = app.agent("worker", "ハル");
    agent.backend = "ollama".to_owned();
    agent.model = "fixture-tools".to_owned();
    agent.backend_options.insert("enableTools".to_owned(), serde_json::json!(true));
    *app.store.agents.lock().iter_mut().find(|a| a.id == agent.id).unwrap_or_else(|| panic!("fixture agent missing")) =
        agent.clone();
    let mut backend = ready_backend("ollama");
    backend.models.push(guild_domain::backend::ModelSpec {
        id: agent.model.clone(),
        label: agent.model.clone(),
        description: String::new(),
        efforts: Vec::new(),
        default_effort: None,
        tools: Some(true),
    });
    app.runtime.backends.lock().push(backend);
    agent
}
