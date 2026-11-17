use super::notifications::REQUEST;
use crate::support::runtime::{reply, Script};
use crate::support::TestApp;
use guild_application::notifications::NotificationOutcome;
use std::sync::Arc;
use tokio::sync::Notify;

#[tokio::test]
async fn notifications_receipt_write_failure_suppresses_delivery_and_preserves_conversation() {
    let app = TestApp::new();
    *app.store.reject_notification_receipts.lock() = true;
    let manager = app.agent("manager", "進行");
    let channel = app.channel("通知", &[&manager]);
    app.runtime.script(manager.id.as_str(), reply(REQUEST));
    app.runtime.script(manager.id.as_str(), reply("続行しました"));
    app.services.conversation.send_human_message(&channel.id, "依頼", &[]).unwrap();
    app.settle().await;
    assert!(app.notifier.calls.lock().is_empty());
    let transcript = app.transcript(&channel).join("\n");
    assert!(transcript.contains("完了しました。"));
    assert!(transcript.contains("デスクトップ通知を送信できませんでした"));
    assert!(!transcript.contains("OSへ送信しました"));
    app.services.conversation.send_human_message(&channel.id, "続けて", &[]).unwrap();
    app.settle().await;
    assert!(app.transcript(&channel).last().unwrap().contains("続行しました"));
}

#[tokio::test]
async fn notifications_setting_is_checked_after_a_running_job_finishes() {
    let app = TestApp::new();
    let manager = app.agent("manager", "進行");
    let channel = app.channel("通知", &[&manager]);
    let gate = Arc::new(Notify::new());
    app.runtime.script(manager.id.as_str(), Script::Gate(gate.clone(), REQUEST.to_owned()));
    app.services.conversation.send_human_message(&channel.id, "依頼", &[]).unwrap();
    while app.runtime.requests.lock().is_empty() {
        tokio::task::yield_now().await;
    }
    app.notifications.set_enabled(false).unwrap();
    gate.notify_one();
    app.settle().await;
    assert!(app.notifier.calls.lock().is_empty());
    let message = app.messages(&channel)[1].clone();
    app.notifications.set_enabled(true).unwrap();
    assert_eq!(
        app.notifications.submit_once(message.id.as_str(), "進行", "完了").unwrap(),
        NotificationOutcome::Duplicate
    );
}

#[tokio::test]
async fn notifications_concurrent_submissions_claim_one_receipt() {
    let app = TestApp::new();
    let handles: Vec<_> = (0..12)
        .map(|_| {
            let service = app.notifications.clone();
            std::thread::spawn(move || service.submit_once("same-message", "進行", "完了").unwrap())
        })
        .collect();
    let submitted = handles
        .into_iter()
        .filter_map(|handle| (handle.join().unwrap() == NotificationOutcome::Submitted).then_some(()))
        .count();
    assert_eq!(submitted, 1);
    assert_eq!(app.notifier.calls.lock().len(), 1);
}

#[tokio::test]
async fn notifications_failed_pass_and_quoted_results_do_not_submit() {
    let app = TestApp::new();
    let manager = app.agent("manager", "進行");
    let channel = app.channel("通知", &[&manager]);
    for script in [Script::Fail(REQUEST.to_owned()), reply("[PASS]"), reply(&format!("````text\n{REQUEST}\n````"))] {
        app.runtime.script(manager.id.as_str(), script);
        app.services.conversation.send_human_message(&channel.id, "依頼", &[]).unwrap();
        app.settle().await;
    }
    assert!(app.notifier.calls.lock().is_empty());
}

#[tokio::test]
async fn notifications_coexist_with_tasks_and_skill_usage_footer() {
    let app = TestApp::new();
    let manager = app.agent("manager", "進行");
    let worker = app.agent("worker", "作業者");
    let channel = app.channel("通知", &[&manager, &worker]);
    let request = "割り振りました。\n\n```tasks\n@作業者: 調査してください\n```\n\n```notify\n作業を開始します\n```\n```skill-usage\n[\"universal-manager\"]\n```";
    app.runtime.script(manager.id.as_str(), reply(request));
    app.runtime.script(worker.id.as_str(), reply("調査しました"));
    app.services.conversation.send_human_message(&channel.id, "@進行 依頼", &[]).unwrap();
    app.settle().await;
    assert_eq!(app.notifier.calls.lock().len(), 1);
    assert_eq!(app.runtime.requests_for(worker.id.as_str()).len(), 1);
    let message = app.messages(&channel)[1].clone();
    assert!(message.content.contains("```tasks"));
    assert!(!message.content.contains("```notify"));
    assert_eq!(message.skill_usage.unwrap().declared, ["universal-manager"]);
}
