//! 言語: 起動のたびに環境変数 GUILD_LANGUAGE で渡し、変わったら setLanguage を送る。このクレートの文面もその言語になる。

use runner_client::{RunnerClient, RunnerStatus};

use crate::support::{config, is_unavailable, no_updates, ready_client, request, wait_status, within};

async fn context_language(client: &RunnerClient, id: &str) -> serde_json::Value {
    let context = within(client.run(id, request("context"), no_updates())).await;
    let context = context.unwrap_or_else(|error| panic!("context: {error}"));
    let context: serde_json::Value = serde_json::from_str(&context).unwrap_or_else(|error| panic!("JSON: {error}"));
    context["language"].clone()
}

#[tokio::test]
async fn the_language_is_passed_at_launch_and_sent_when_it_changes() {
    let client = ready_client("ok.mjs").await;
    assert_eq!(context_language(&client, "c1").await, "ja");
    let mut backends = client.watch_backends();
    backends.borrow_and_update();
    client.set_language("en").await;
    within(backends.changed()).await.expect("backends が届く");
    assert_eq!(client.backends()[0].status_message, "language:en", "ランナーが送り直した backends");

    let crashed = within(client.run("x", request("crash"), no_updates())).await;
    assert!(crashed.is_err(), "落ちたはず");
    wait_status(&client, |status| *status == RunnerStatus::Ready).await;
    assert_eq!(context_language(&client, "c2").await, "en", "起動し直したランナーには新しい言語を渡す");
    client.shutdown().await;
}

#[tokio::test]
async fn messages_from_this_crate_follow_the_language() {
    let mut english = config("version-999.mjs");
    english.language = "en".to_owned();
    let client = RunnerClient::new(english);
    let status = wait_status(&client, is_unavailable).await;
    assert!(
        matches!(&status, RunnerStatus::Unavailable { message }
            if message.contains("protocol version does not match") && message.contains("(restarting automatically)")),
        "{status:?}"
    );
    client.shutdown().await;
}
