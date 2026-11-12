use crate::support::runtime::{ready_backend, reply, Script};
use crate::support::TestApp;
use guild_domain::backend::{BackendInfo, FolderScope};
use guild_domain::channel::WorkspaceMode;

/// 割り当てるフォルダ（その OS の絶対パス。"/project" は Windows では絶対パスにならず、検証で落ちる）
const PROJECT: &str = if cfg!(windows) { r"C:\project" } else { "/project" };

#[tokio::test]
async fn scope_changes_separate_history_memory_and_state_and_shared_returns_to_the_agent_workspace() {
    let app = TestApp::new();
    let agent = ollama_worker(&app);
    let channel = app.channel("作業", &[&agent]);
    *app.workspace.memory.lock() = "SHARED_PRIVATE_MEMORY".to_owned();
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
    assert!(!scoped.system_prompt.contains("SHARED_PRIVATE_MEMORY"));
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
    // 共通に戻すと、エージェント共通の作業場所とメモに戻る。範囲を変える前の会話は渡さない
    let restored = app.services.conversation.configure_workspace(&channel.id, WorkspaceMode::Shared, None).await;
    assert_eq!(restored.unwrap().workspace.revision, 2);
    app.services.conversation.send_human_message(&channel.id, "@ハル RESTORED_TASK", &[]).unwrap();
    app.settle().await;
    let requests = app.runtime.requests_for(agent.id.as_str());
    let restored = requests.last().unwrap();
    assert_eq!(restored.workspace, requests[0].workspace);
    assert_eq!(restored.state_dir, requests[0].state_dir);
    assert!(restored.prompt.contains("RESTORED_TASK"));
    assert!(!restored.prompt.contains("NEW_TASK") && !restored.prompt.contains("OLD_PRIVATE_TASK"));
    assert!(restored.system_prompt.contains("SHARED_PRIVATE_MEMORY"));
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

/// backend のエージェントを、指定フォルダにしたチャンネルに入れる（folder_scope はそのバックエンドの申告）
async fn folder_channel(
    app: &TestApp,
    backend: &str,
    folder_scope: Option<FolderScope>,
) -> (guild_domain::agent::Agent, guild_domain::channel::Channel) {
    let mut agent = app.agent("worker", "ハル");
    agent.backend = backend.to_owned();
    for saved in app.store.agents.lock().iter_mut().filter(|saved| saved.id == agent.id) {
        saved.backend.clone_from(&agent.backend);
    }
    app.runtime.backends.lock().push(BackendInfo { folder_scope, ..ready_backend(backend) });
    let channel = app.channel("作業", &[&agent]);
    let configured =
        app.services.conversation.configure_workspace(&channel.id, WorkspaceMode::Folder, Some(PROJECT.to_owned()));
    (agent, configured.await.unwrap_or_else(|error| panic!("{error}")))
}

#[tokio::test]
async fn backends_that_do_not_declare_a_folder_scope_stop_before_runtime() {
    let app = TestApp::new();
    let (agent, channel) = folder_channel(&app, "unscoped", None).await;
    app.services.conversation.send_human_message(&channel.id, "@ハル FILE_TASK", &[]).unwrap();
    app.settle().await;
    assert!(app.runtime.requests_for(agent.id.as_str()).is_empty());
    let transcript = app.transcript(&channel).join("\n");
    assert!(
        transcript.contains("unscoped は範囲を守れないため、指定フォルダのチャンネルでは実行できません"),
        "{transcript}"
    );
}

#[tokio::test]
async fn sandboxed_backends_keep_commands_inside_the_folder_scope() {
    let app = TestApp::new();
    let (agent, channel) = folder_channel(&app, "sandboxed", Some(FolderScope::Sandbox)).await;
    app.runtime.script(agent.id.as_str(), reply("done"));
    app.services.conversation.send_human_message(&channel.id, "@ハル FILE_TASK", &[]).unwrap();
    app.settle().await;
    let requests = app.runtime.requests_for(agent.id.as_str());
    let scoped = requests.last().unwrap();
    let project = std::path::PathBuf::from(PROJECT);
    assert_eq!(scoped.writable_dirs.as_ref().unwrap(), &vec![project.clone()]);
    assert!(scoped.readable_dirs.contains(&project));
    // シェルごと隔離に入れるので、コマンドは残す。PC 全体の読み書きとスキルは外す
    let permissions = &scoped.permissions;
    assert!(permissions.run_commands && permissions.write_files);
    assert!(!permissions.read_anywhere && !permissions.write_anywhere && !permissions.skills);
    assert!(scoped.system_prompt.contains("コマンドはこの範囲の中でだけ動きます"));
}

/// 道具の利用を切り替えるバックエンド（ファイルの道具ごとに範囲を確かめる）で、道具を有効にした作業者
fn ollama_worker(app: &TestApp) -> guild_domain::agent::Agent {
    let mut agent = app.agent("worker", "ハル");
    agent.backend = "ollama".to_owned();
    agent.model = "fixture-tools".to_owned();
    agent.backend_options.insert("enableTools".to_owned(), serde_json::json!(true));
    *app.store.agents.lock().iter_mut().find(|a| a.id == agent.id).unwrap_or_else(|| panic!("fixture agent missing")) =
        agent.clone();
    let mut backend = BackendInfo {
        folder_scope: Some(FolderScope::Files),
        tools_option: Some("enableTools".to_owned()),
        ..ready_backend("ollama")
    };
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
