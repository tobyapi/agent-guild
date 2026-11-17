use super::notifications::REQUEST;
use crate::support::runtime::Script;
use crate::support::TestApp;
use std::sync::Arc;
use tokio::sync::Notify;

#[tokio::test]
async fn notifications_late_success_after_stop_does_not_submit() {
    let app = TestApp::new();
    let manager = app.agent("manager", "進行");
    let channel = app.channel("通知", &[&manager]);
    let gate = Arc::new(Notify::new());
    app.runtime.script(manager.id.as_str(), Script::Stubborn(gate.clone(), REQUEST.to_owned()));
    app.services.conversation.send_human_message(&channel.id, "依頼", &[]).unwrap();
    while app.runtime.requests.lock().is_empty() {
        tokio::task::yield_now().await;
    }
    let conversation = app.services.conversation.clone();
    let id = channel.id.clone();
    let stop = tokio::spawn(async move { conversation.stop(&id).await.unwrap() });
    while app.runtime.cancelled.lock().is_empty() {
        tokio::task::yield_now().await;
    }
    gate.notify_one();
    stop.await.unwrap();
    app.settle().await;
    assert!(app.notifier.calls.lock().is_empty());
    assert!(!app.transcript(&channel).join("\n").contains("完了しました"));
}
