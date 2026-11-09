//! 実行: 途中経過と途中の投稿の中継・要求の形・エラーコード・cancel と猶予・job_id ごとの配送。

use std::sync::Arc;
use std::time::Instant;

use runner_client::{ErrorCode, RunUpdate, RunnerClient, RunnerError};

use crate::support::{no_updates, ready_client, request, updates, within, CANCEL_GRACE};

#[tokio::test]
async fn run_relays_activity_and_posts_then_returns_the_result() {
    let client = ready_client("ok.mjs").await;
    let (on_update, mut updates) = updates();
    let text = within(client.run("j1", request("echo:こんにちは"), on_update)).await.expect("result");
    assert_eq!(text, "こんにちは");
    assert_eq!(updates.recv().await, Some(RunUpdate::Activity("working:こんにちは".to_owned())));
    assert_eq!(updates.recv().await, Some(RunUpdate::Post("posted:こんにちは".to_owned())));
    client.shutdown().await;
}

#[tokio::test]
async fn run_request_has_the_protocol_shape() {
    let client = ready_client("ok.mjs").await;
    let text = within(client.run("j1", request("inspect"), no_updates())).await.expect("inspect");
    let sent: serde_json::Value = serde_json::from_str(&text).expect("JSON");
    assert_eq!(sent["type"], "run");
    assert_eq!(sent["id"], "j1");
    assert_eq!(sent["stateDir"], r"C:\data\agents\a1\state\fake");
    assert_eq!(sent["readableDirs"][0], r"C:\data\agents\a0\work");
    assert_eq!(sent["permissions"]["runCommands"], false);
    assert_eq!(sent["intent"], "# 人間の依頼\n> 試して\n");
    assert_eq!(sent["skills"][0]["name"], "review-checklist");
    assert_eq!(sent["options"]["maxTurns"], 3);
    client.shutdown().await;
}

#[tokio::test]
async fn runner_errors_keep_their_codes() {
    let client = ready_client("ok.mjs").await;
    let auth = within(client.run("a", request("fail:auth"), no_updates())).await.expect_err("auth");
    assert!(matches!(&auth, RunnerError::Backend { code: ErrorCode::Auth, message } if message == "失敗: auth"));
    let denied = within(client.run("b", request("fail:unsupported_permission"), no_updates())).await;
    assert!(matches!(denied, Err(RunnerError::Backend { code: ErrorCode::UnsupportedPermission, .. })));
    let cancelled = within(client.run("c", request("fail:cancelled"), no_updates())).await;
    assert!(matches!(cancelled, Err(RunnerError::Cancelled)));
    client.shutdown().await;
}

/// hang などを別タスクで走らせ、ランナーが受け取った（activity が届いた）ところで返す
async fn start_waiting_job(
    client: &Arc<RunnerClient>,
    prompt: &str,
) -> tokio::task::JoinHandle<Result<String, RunnerError>> {
    let (on_update, mut updates) = updates();
    let running = tokio::spawn({
        let client = Arc::clone(client);
        let request = request(prompt);
        async move { client.run("job", request, on_update).await }
    });
    assert_eq!(within(updates.recv()).await, Some(RunUpdate::Activity("waiting".to_owned())));
    running
}

#[tokio::test]
async fn cancel_returns_as_soon_as_the_runner_stops() {
    let client = Arc::new(ready_client("ok.mjs").await);
    let running = start_waiting_job(&client, "hang").await;
    let started = Instant::now();
    client.cancel("job").await;
    let outcome = within(running).await.expect("タスク");
    assert!(matches!(outcome, Err(RunnerError::Cancelled)), "{outcome:?}");
    assert!(started.elapsed() < CANCEL_GRACE, "終端イベントが来たら猶予を待たない");
    client.shutdown().await;
}

#[tokio::test]
async fn cancel_gives_up_after_the_grace_period() {
    let client = Arc::new(ready_client("ok.mjs").await);
    let running = start_waiting_job(&client, "stubborn").await;
    let started = Instant::now();
    client.cancel("job").await;
    let outcome = within(running).await.expect("タスク");
    assert!(matches!(outcome, Err(RunnerError::Cancelled)), "{outcome:?}");
    assert!(started.elapsed() >= CANCEL_GRACE, "終端イベントが来なければ猶予まで待つ");
    client.shutdown().await;
}

#[tokio::test]
async fn result_arriving_after_cancel_is_reported_as_cancelled() {
    let client = Arc::new(ready_client("ok.mjs").await);
    let running = start_waiting_job(&client, "late").await;
    client.cancel("job").await;
    assert!(matches!(within(running).await.expect("タスク"), Err(RunnerError::Cancelled)));
    let next = within(client.run("job", request("echo:next"), no_updates())).await;
    assert_eq!(next.expect("同じ id で次の実行ができる"), "next");
    client.shutdown().await;
}

#[tokio::test]
async fn concurrent_runs_are_routed_by_job_id() {
    let client = ready_client("ok.mjs").await;
    let (a, b) = within(async {
        tokio::join!(client.run("a", request("echo:A"), no_updates()), client.run("b", request("echo:B"), no_updates()))
    })
    .await;
    assert_eq!((a.expect("a").as_str(), b.expect("b").as_str()), ("A", "B"));
    client.shutdown().await;
}

#[tokio::test]
async fn duplicate_job_id_is_rejected_and_unknown_cancel_is_ignored() {
    let client = Arc::new(ready_client("ok.mjs").await);
    let running = start_waiting_job(&client, "hang").await;
    let duplicate = within(client.run("job", request("echo:x"), no_updates())).await;
    assert!(matches!(duplicate, Err(RunnerError::Protocol(_))), "{duplicate:?}");
    client.cancel("nobody").await;
    client.cancel("job").await;
    assert!(matches!(within(running).await.expect("タスク"), Err(RunnerError::Cancelled)));
    client.shutdown().await;
}

/// コンパイルが通れば十分（RunnerClient は Send + Sync、run の future は Send）
fn _client_and_run_future_are_send(client: &RunnerClient) {
    fn assert_send<T: Send>(_: &T) {}
    fn assert_send_sync<T: Send + Sync>() {}
    assert_send_sync::<RunnerClient>();
    assert_send(&client.run("j", request("x"), no_updates()));
}
