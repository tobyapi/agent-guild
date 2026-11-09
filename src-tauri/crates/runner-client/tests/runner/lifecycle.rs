//! 起動・版の確認・タイムアウト・異常終了からの再起動・probe・shutdown。

use std::time::Duration;

use runner_client::{BackendStatus, Launch, OptionKind, PermissionKey, RunnerClient, RunnerError, RunnerStatus};

use crate::support::{config, fixture, is_unavailable, no_activity, ready_client, request, wait_status, within};

#[tokio::test]
async fn starts_and_publishes_backends() {
    let client = RunnerClient::new(config("ok.mjs"));
    assert_eq!(client.status(), RunnerStatus::Starting);
    assert!(client.backends().is_empty());
    wait_status(&client, |status| *status == RunnerStatus::Ready).await;
    let backends = client.backends();
    assert_eq!(backends.len(), 1);
    assert_eq!(backends[0].id, "fake");
    assert_eq!(backends[0].status, BackendStatus::Ready);
    assert_eq!(backends[0].options[0].kind, OptionKind::Number);
    assert!(backends[0].capabilities.skills && !backends[0].capabilities.run_commands);
    let rule = &backends[0].permission_rules[0];
    assert_eq!((rule.when, rule.requires.as_slice()), (PermissionKey::WriteFiles, &[PermissionKey::RunCommands][..]));
    client.shutdown().await;
}

#[tokio::test]
async fn passes_args_env_and_cwd_to_the_runner() {
    let client = ready_client("ok.mjs").await;
    let context = within(client.run("ctx", request("context"), no_activity())).await.expect("context");
    let context: serde_json::Value = serde_json::from_str(&context).expect("JSON");
    assert_eq!(context["args"], serde_json::json!(["--from-test"]));
    assert_eq!(context["flag"], "on");
    assert!(context["cwd"].as_str().is_some_and(|cwd| cwd.ends_with("fixtures")), "{context}");
    client.shutdown().await;
}

#[tokio::test]
async fn version_mismatch_makes_runner_unavailable() {
    let client = RunnerClient::new(config("version-999.mjs"));
    let status = wait_status(&client, is_unavailable).await;
    assert!(matches!(&status, RunnerStatus::Unavailable { message } if message.contains("期待 1、実際 999")), "{status:?}");
    let error = within(client.run("j1", request("echo:x"), no_activity())).await.expect_err("使えないはず");
    assert!(matches!(error, RunnerError::Unavailable(_)), "{error:?}");
    client.shutdown().await;
}

#[tokio::test]
async fn silent_runner_times_out() {
    let mut config = config("silent.mjs");
    config.ready_timeout = Duration::from_millis(300);
    let client = RunnerClient::new(config);
    let status = wait_status(&client, is_unavailable).await;
    assert!(matches!(&status, RunnerStatus::Unavailable { message } if message.contains("タイムアウト")), "{status:?}");
    client.shutdown().await;
}

#[tokio::test]
async fn missing_executable_is_unavailable() {
    let mut config = config("ok.mjs");
    config.launch = Launch::Binary { path: fixture("no-such-runner.exe") };
    let client = RunnerClient::new(config);
    let status = wait_status(&client, is_unavailable).await;
    assert!(matches!(&status, RunnerStatus::Unavailable { message } if message.contains("起動できませんでした")), "{status:?}");
    client.shutdown().await;
}

#[tokio::test]
async fn crash_disconnects_the_running_job_and_restarts() {
    let client = ready_client("ok.mjs").await;
    let first = within(client.run("p1", request("pid"), no_activity())).await.expect("pid");
    let crashed = within(client.run("c1", request("crash"), no_activity())).await.expect_err("落ちたはず");
    assert!(matches!(crashed, RunnerError::Disconnected), "{crashed:?}");
    wait_status(&client, |status| *status != RunnerStatus::Ready).await;
    wait_status(&client, |status| *status == RunnerStatus::Ready).await;
    let second = within(client.run("p2", request("pid"), no_activity())).await.expect("再起動後の pid");
    assert_ne!(first, second, "別のプロセスで動いているはず");
    client.shutdown().await;
}

#[tokio::test]
async fn probe_refreshes_backends() {
    let client = ready_client("ok.mjs").await;
    let mut backends = client.watch_backends();
    backends.mark_unchanged();
    client.probe().await;
    within(backends.changed()).await.expect("backends が届く");
    let refreshed = client.backends();
    assert_eq!(refreshed[0].status, BackendStatus::NeedsAuth);
    assert_eq!(refreshed[0].status_message, "ログインしてください");
    client.shutdown().await;
}

#[tokio::test]
async fn login_waits_for_the_runner_and_the_refreshed_backends_arrive_first() {
    let client = ready_client("ok.mjs").await;
    assert!(client.backends()[0].can_login);
    let mut backends = client.watch_backends();
    backends.mark_unchanged();
    client.probe().await;
    within(backends.changed()).await.expect("backends が届く");
    assert_eq!(client.backends()[0].status, BackendStatus::NeedsAuth);
    within(client.login("login-1", "fake")).await.expect("ログインが終わる");
    assert_eq!(client.backends()[0].status, BackendStatus::Ready, "result より先に届いた backends が反映済み");
    client.shutdown().await;
}

#[tokio::test]
async fn shutdown_stops_the_runner_for_good() {
    let client = ready_client("ok.mjs").await;
    within(client.shutdown()).await;
    let status = wait_status(&client, is_unavailable).await;
    assert!(matches!(&status, RunnerStatus::Unavailable { message } if message.contains("停止")), "{status:?}");
    assert!(client.backends().is_empty());
    let error = within(client.run("j1", request("echo:x"), no_activity())).await.expect_err("停止後は使えない");
    assert!(matches!(error, RunnerError::Unavailable(_)), "{error:?}");
}
