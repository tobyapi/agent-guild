//! 自発活動（design.md §10）: tick と今すぐ1回。

use std::sync::Arc;
use std::time::Duration;

use guild_application::AppError;
use guild_domain::agent::Agent;
use guild_domain::message::MessageKind;
use tokio::sync::Notify;

use crate::support::runtime::{reply, Script};
use crate::support::{input, TestApp, STARTED_AT};

const MINUTE: i64 = 60_000;
/// 5分間隔 + 揺らぎの最大（59秒）を過ぎた時刻
const DUE: i64 = STARTED_AT + 6 * MINUTE;

fn autonomous_worker(app: &TestApp, name: &str) -> Agent {
    let mut worker = input("worker", name);
    worker.autonomy_enabled = true;
    worker.autonomy_interval_min = 5;
    app.services.agents.create(worker).unwrap_or_else(|e| panic!("{e}"))
}

#[tokio::test]
async fn a_due_worker_posts_on_its_own() {
    let app = TestApp::new();
    let haru = autonomous_worker(&app, "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    app.runtime.script(haru.id.as_str(), reply("面白い記事を見つけました"));

    assert_eq!(app.services.autonomy.tick(STARTED_AT + MINUTE).await, Ok(0), "まだ早い");
    assert_eq!(app.services.autonomy.tick(DUE).await, Ok(1));
    app.settle().await;

    let messages = app.messages(&lobby);
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].kind, MessageKind::Autonomous);
    assert_eq!(messages[0].root_id, messages[0].id, "自発投稿は自分が起点");
    let stored = app.store.agents.lock().iter().find(|a| a.id == haru.id).cloned();
    assert_eq!(stored.and_then(|a| a.last_autonomous_at), Some(DUE));
    assert!(app.runtime.requests_for(haru.id.as_str())[0].prompt.contains("いまは自由時間です"));
}

#[tokio::test]
async fn a_busy_worker_is_skipped() {
    let app = TestApp::new();
    let haru = autonomous_worker(&app, "ハル");
    let (lobby, lab) = (app.channel("ロビー", &[&haru]), app.channel("実験", &[&haru]));
    let busy = Arc::new(Notify::new());
    app.runtime.script(haru.id.as_str(), Script::Gate(busy.clone(), "作業中".to_owned()));
    app.services.conversation.send_human_message(&lab.id, "お願い", &[]).unwrap();
    tokio::time::sleep(Duration::from_millis(20)).await;

    assert_eq!(app.services.autonomy.tick(DUE).await, Ok(0), "どこかで実行中なら積まない");
    busy.notify_one();
    app.settle().await;
    assert!(app.messages(&lobby).is_empty());
}

#[tokio::test]
async fn run_now_needs_only_a_channel_whatever_the_settings() {
    let app = TestApp::new();
    let logica = app.agent("expert", "ロジカ");
    assert!(matches!(app.services.autonomy.run_now(&logica.id), Err(AppError::Validation(_))), "参加チャンネルなし");

    let lobby = app.channel("ロビー", &[&logica]);
    app.runtime.script(logica.id.as_str(), reply("気になった論点です"));
    app.services.autonomy.run_now(&logica.id).unwrap();
    app.settle().await;
    assert_eq!(app.transcript(&lobby), vec!["ロジカ: 気になった論点です"]);
}
