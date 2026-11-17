use crate::support::runtime::{reply, Script};
use crate::support::{input, TestApp};
use guild_application::notifications::NotificationOutcome;

pub const REQUEST: &str = "完了しました。\n\n```notify\n作業が完了しました\n```";

#[tokio::test]
async fn notifications_titles_remove_controls_and_preserve_normal_names() {
    for (name, expected) in [
        ("進行Muse🌙", "AI Guild · 進行Muse🌙"),
        ("進行 Muse 🌙", "AI Guild · 進行 Muse 🌙"),
        ("進\0行\nMuse\r\t\u{7f}\u{85}", "AI Guild · 進行Muse"),
    ] {
        let app = TestApp::new();
        let manager = app.agent("manager", "進行");
        // New names are validated; persisted data still needs safe display at the OS boundary.
        app.store.agents.lock()[0].name = name.to_owned();
        let channel = app.channel("通知", &[&manager]);
        app.runtime.script(manager.id.as_str(), reply(REQUEST));
        app.services.conversation.send_human_message(&channel.id, "依頼", &[]).unwrap();
        app.settle().await;
        assert_eq!(*app.notifier.calls.lock(), vec![(expected.to_owned(), "作業が完了しました".to_owned())]);
        assert!(app.messages(&channel).iter().any(|message| message.content == "デスクトップ通知を送信しました。"));
    }
}

#[tokio::test]
async fn notifications_only_a_current_manager_final_reply_can_submit() {
    for (role, backend, can_delegate, enabled) in
        ["worker", "expert", "ideator", "manager"].into_iter().flat_map(|role| {
            ["claude", "codex", "future-backend"].into_iter().flat_map(move |backend| {
                [false, true]
                    .into_iter()
                    .flat_map(move |delegate| [false, true].map(move |enabled| (role, backend, delegate, enabled)))
            })
        })
    {
        let app = TestApp::new();
        app.runtime.backends.lock().push(crate::support::runtime::ready_backend(backend));
        app.notifications.set_enabled(enabled).unwrap();
        let mut data = input(role, "担当");
        data.can_delegate = can_delegate;
        data.backend = backend.to_owned();
        let agent = app.services.agents.create(data).unwrap();
        let channel = app.channel("通知", &[&agent]);
        app.runtime.script(agent.id.as_str(), reply(REQUEST));
        app.services.conversation.send_human_message(&channel.id, "@担当 確認", &[]).unwrap();
        app.settle().await;
        assert_eq!(
            app.notifier.calls.lock().len(),
            usize::from(role == "manager" && enabled),
            "{role}/{backend}/{can_delegate}/{enabled}"
        );
        let prompt = &app.runtime.requests_for(agent.id.as_str())[0].system_prompt;
        assert_eq!(prompt.contains("## デスクトップ通知"), role == "manager");
        if role == "manager" {
            assert_eq!(app.messages(&channel)[1].content, "完了しました。");
        }
    }
}

#[tokio::test]
async fn notifications_disabled_receipts_are_never_replayed_after_enabling_or_restart() {
    let app = TestApp::new();
    app.notifications.set_enabled(false).unwrap();
    assert_eq!(app.notifications.submit_once("disabled", "進行", "完了").unwrap(), NotificationOutcome::Disabled);
    app.notifications.set_enabled(true).unwrap();
    assert_eq!(app.notifications.submit_once("disabled", "進行", "完了").unwrap(), NotificationOutcome::Duplicate);
    let restarted = app.restart();
    assert_eq!(
        restarted.notifications.submit_once("disabled", "進行", "完了").unwrap(),
        NotificationOutcome::Duplicate
    );
    assert!(app.notifier.calls.lock().is_empty());
    assert!(restarted.notifier.calls.lock().is_empty());
}

#[tokio::test]
async fn notifications_body_cannot_trigger_mentions_or_tasks() {
    let app = TestApp::new();
    let manager = app.agent("manager", "進行");
    let worker = app.agent("worker", "作業者");
    let channel = app.channel("通知", &[&manager, &worker]);
    let request = "完了しました。\n\n```notify\n@作業者 確認してください\n```";
    app.runtime.script(manager.id.as_str(), reply(request));
    app.services.conversation.send_human_message(&channel.id, "@進行 依頼", &[]).unwrap();
    app.settle().await;
    assert_eq!(app.notifier.calls.lock()[0].1, "@作業者 確認してください");
    assert!(app.runtime.requests_for(worker.id.as_str()).is_empty());
    assert!(app.store.delegations.lock().is_empty());
    assert!(app.messages(&channel)[1].mentions.is_empty());
}

#[tokio::test]
async fn notifications_human_history_and_progress_do_not_submit() {
    let app = TestApp::new();
    let manager = app.agent("manager", "進行");
    let channel = app.channel("通知", &[&manager]);
    app.runtime.script(manager.id.as_str(), Script::Posts(vec![REQUEST.to_owned()], "通常の返答".to_owned()));
    app.services.conversation.send_human_message(&channel.id, REQUEST, &[]).unwrap();
    app.settle().await;
    assert!(app.notifier.calls.lock().is_empty());
    let _ = app.services.conversation.list_messages(&channel.id, None, None).unwrap();
    assert!(app.notifier.calls.lock().is_empty());
}

#[tokio::test]
async fn notifications_disabled_and_failed_requests_leave_conversation_usable() {
    for enabled in [false, true] {
        let app = TestApp::new();
        app.notifications.set_enabled(enabled).unwrap();
        *app.notifier.fail.lock() = true;
        let manager = app.agent("manager", "進行");
        let channel = app.channel("通知", &[&manager]);
        app.runtime.script(manager.id.as_str(), reply(REQUEST));
        app.runtime.script(manager.id.as_str(), reply("次の返答"));
        app.services.conversation.send_human_message(&channel.id, "依頼", &[]).unwrap();
        app.settle().await;
        let transcript = app.transcript(&channel).join("\n");
        assert!(transcript.contains("完了しました。"));
        assert!(!transcript.contains("表示しました"));
        assert_eq!(app.notifier.calls.lock().len(), usize::from(enabled));
        app.services.conversation.send_human_message(&channel.id, "続けて", &[]).unwrap();
        app.settle().await;
        assert!(app.transcript(&channel).last().unwrap().contains("次の返答"));
    }
}

#[tokio::test]
async fn notifications_same_message_is_not_submitted_again_even_after_restart_or_failure() {
    let app = TestApp::new();
    for fail in [false, true] {
        *app.notifier.fail.lock() = fail;
        let id = if fail { "failed-message" } else { "successful-message" };
        let result = app.notifications.submit_once(id, "進行", "完了");
        assert_eq!(result.is_err(), fail);
        let restarted = app.restart();
        assert_eq!(restarted.notifications.submit_once(id, "進行", "完了").unwrap(), NotificationOutcome::Duplicate);
        assert!(restarted.notifier.calls.lock().is_empty());
    }
    assert_eq!(app.notifier.calls.lock().len(), 2);
}

#[tokio::test]
async fn notifications_role_change_during_run_revokes_permission() {
    use std::sync::Arc;
    use tokio::sync::Notify;
    let app = TestApp::new();
    let manager = app.agent("manager", "進行");
    let channel = app.channel("通知", &[&manager]);
    let gate = Arc::new(Notify::new());
    app.runtime.script(manager.id.as_str(), Script::Gate(gate.clone(), REQUEST.to_owned()));
    app.services.conversation.send_human_message(&channel.id, "依頼", &[]).unwrap();
    while app.runtime.requests.lock().is_empty() {
        tokio::task::yield_now().await;
    }
    let mut changed = input("worker", "進行");
    changed.can_delegate = true;
    app.services.agents.update(&manager.id, changed).unwrap();
    gate.notify_one();
    app.settle().await;
    assert!(app.notifier.calls.lock().is_empty());
}
