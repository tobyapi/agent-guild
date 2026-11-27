use std::path::Path;

use crate::support::runtime::reply;
use crate::support::{TestApp, DATA_DIR};
use guild_application::ports::SettingsStore;
use guild_domain::agent::Agent;
use guild_domain::channel::Channel;

fn default_home() -> String {
    Path::new(DATA_DIR).join("worktrees").display().to_string()
}

/// 1回実行して、そのシステムプロンプトの置き場の行を返す
async fn rule_after_run(app: &TestApp, agent: &Agent, channel: &Channel) -> String {
    app.runtime.script(agent.id.as_str(), reply("[PASS]"));
    if let Err(error) = app.services.conversation.send_human_message(&channel.id, "run", &[]) {
        panic!("送れません: {error}");
    }
    app.settle().await;
    let Some(request) = app.runtime.requests_for(agent.id.as_str()).pop() else {
        panic!("実行されていません");
    };
    let line = request.system_prompt.lines().find(|line| line.starts_with("git worktree を作るときは"));
    line.unwrap_or_else(|| {
        panic!(
            "置き場のルールがありません:
{}",
            request.system_prompt
        )
    })
    .to_owned()
}

#[tokio::test]
async fn worktree_home_defaults_to_the_data_folder_and_reaches_the_next_run() {
    let app = TestApp::new();
    // 作業者は役割の表で作業場所の外にも書け、コマンドも使える
    let agent = app.agent("worker", "Worker");
    let channel = app.channel("test", &[&agent]);
    let home = app.services.worktree_home.get().unwrap();
    assert_eq!((home.path, home.default_path.clone()), (None, default_home()));
    assert!(rule_after_run(&app, &agent, &channel).await.contains(&default_home()));

    app.services.worktree_home.set(Some(r"  E:\wt  ".to_owned())).unwrap();
    assert_eq!(app.settings.load().unwrap().worktree_home.as_deref(), Some(r"E:\wt"));
    let line = rule_after_run(&app, &agent, &channel).await;
    assert!(line.contains(r"E:\wt") && !line.contains(&default_home()), "再起動なしで次の実行から: {line}");

    app.services.worktree_home.set(Some(String::new())).unwrap();
    assert_eq!(app.services.worktree_home.get().unwrap().path, None, "空にすると既定に戻る");
    assert!(rule_after_run(&app, &agent, &channel).await.contains(&default_home()));
}

#[tokio::test]
async fn relative_homes_are_rejected_and_keep_other_settings() {
    let app = TestApp::new();
    let mut settings = app.settings.load().unwrap();
    settings.setup_done = true;
    settings.global_instructions = "KEEP".to_owned();
    app.settings.save(&settings).unwrap();
    app.services.worktree_home.set(Some(r"D:\wt".to_owned())).unwrap();
    let saved = app.settings.load().unwrap();
    assert!(saved.setup_done && saved.global_instructions == "KEEP");
    assert!(app.services.worktree_home.set(Some("worktrees".to_owned())).is_err());
    assert_eq!(app.settings.load().unwrap(), saved, "拒否したら何も変えない");
}

#[tokio::test]
async fn hand_edited_or_unreadable_settings_fall_back_to_the_default() {
    for mode in ["relative", "unreadable"] {
        let app = TestApp::new();
        let mut settings = app.settings.load().unwrap();
        settings.worktree_home = Some("relative".to_owned());
        app.settings.save(&settings).unwrap();
        app.settings.fail_load.store(mode == "unreadable", std::sync::atomic::Ordering::SeqCst);
        assert_eq!(app.services.worktree_home.effective(), default_home(), "{mode}");
    }
}

#[tokio::test]
async fn the_screen_shows_the_same_home_as_the_prompt() {
    for (saved, shown) in
        [(Some("relative"), None), (Some("   "), None), (Some(r"  E:\wt  "), Some(r"E:\wt")), (None, None)]
    {
        let app = TestApp::new();
        let mut settings = app.settings.load().unwrap();
        settings.worktree_home = saved.map(str::to_owned);
        app.settings.save(&settings).unwrap();
        let home = app.services.worktree_home.get().unwrap();
        assert_eq!(home.path.as_deref(), shown, "{saved:?}");
        assert_eq!(home.effective(), app.services.worktree_home.effective(), "画面とプロンプトが同じ置き場: {saved:?}");
    }
}
