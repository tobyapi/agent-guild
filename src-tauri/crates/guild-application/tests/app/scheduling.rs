//! 実行モデル（design.md §6）: 合流・エージェント単位の排他・全体の上限・1つの会話の返答回数に上限がないこと・長時間実行。

use std::sync::Arc;
use std::time::Duration;

use guild_application::ports::SettingsStore;
use guild_domain::activity::ChannelQueue;
use guild_domain::run_limits::RunLimits;
use tokio::sync::Notify;

use crate::support::runtime::{reply, Script};
use crate::support::TestApp;

/// アクターがコマンドを処理し終えるまで少し待つ
async fn tick() {
    for _ in 0..20 {
        tokio::time::sleep(Duration::from_millis(1)).await;
    }
}

fn gate() -> Arc<Notify> {
    Arc::new(Notify::new())
}

#[tokio::test]
async fn pending_jobs_of_the_same_agent_merge_into_one() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    let first = gate();
    app.runtime.script(haru.id.as_str(), Script::Gate(first.clone(), "1つ目に返答".to_owned()));
    app.runtime.script(haru.id.as_str(), reply("2つまとめて返答"));
    let conversation = &app.services.conversation;
    conversation.send_human_message(&lobby.id, "一つ目", &[]).unwrap();
    tick().await;
    conversation.send_human_message(&lobby.id, "二つ目", &[]).unwrap();
    conversation.send_human_message(&lobby.id, "三つ目", &[]).unwrap();
    tick().await;
    let queue = ChannelQueue { channel_id: lobby.id.clone(), running: 1, pending: 1 };
    assert_eq!(conversation.activity().queues, vec![queue], "待機は1件にまとまる");
    first.notify_one();
    app.settle().await;
    let requests = app.runtime.requests_for(haru.id.as_str());
    assert_eq!(requests.len(), 2);
    let pending = requests[1].prompt.split("# あなた宛ての未対応の発言").nth(1).unwrap_or_default().to_owned();
    assert!(pending.contains("二つ目") && pending.contains("三つ目"));
}

#[tokio::test]
async fn an_agent_runs_one_job_at_a_time_across_channels() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let (lobby, lab) = (app.channel("ロビー", &[&haru]), app.channel("実験", &[&haru]));
    let first = gate();
    app.runtime.script(haru.id.as_str(), Script::Gate(first.clone(), "ロビーへ".to_owned()));
    app.runtime.script(haru.id.as_str(), reply("実験へ"));
    app.services.conversation.send_human_message(&lobby.id, "ロビーで", &[]).unwrap();
    tick().await;
    app.services.conversation.send_human_message(&lab.id, "実験で", &[]).unwrap();
    tick().await;
    let activity = app.services.conversation.activity();
    assert_eq!(activity.activities.len(), 1);
    assert!(activity.queues.contains(&ChannelQueue { channel_id: lab.id.clone(), running: 0, pending: 1 }));
    first.notify_one();
    app.settle().await;
    assert_eq!(app.transcript(&lab), vec!["人間: 実験で", "ハル: 実験へ"]);
}

#[tokio::test]
async fn default_allows_more_than_three_jobs_at_once() {
    let app = TestApp::new();
    let gates: Vec<Arc<Notify>> = (0..4).map(|_| gate()).collect();
    for (index, gate) in gates.iter().enumerate() {
        let agent = app.agent("worker", &format!("作業者{index}"));
        let channel = app.channel(&format!("部屋{index}"), &[&agent]);
        app.runtime.script(agent.id.as_str(), Script::Gate(gate.clone(), "完了".to_owned()));
        app.services.conversation.send_human_message(&channel.id, "お願い", &[]).unwrap();
    }
    tick().await;
    let activity = app.services.conversation.activity();
    assert_eq!(activity.activities.len(), 4);
    assert!(activity.queues.iter().all(|queue| queue.pending == 0));
    gates.iter().for_each(|gate| gate.notify_one());
    app.settle().await;
    assert_eq!(app.runtime.requests.lock().len(), 4);
}

#[tokio::test]
async fn saved_limits_apply_to_pending_jobs_when_they_start() {
    let app = TestApp::new();
    let conversation = &app.services.conversation;
    let initial = RunLimits { timeout_minutes: Some(30), max_concurrent_jobs: Some(1) };
    conversation.set_run_limits(initial).await.unwrap();
    assert_eq!(app.settings.load().unwrap().run_limits, initial);

    let gates: Vec<_> = (0..3).map(|_| gate()).collect();
    for (index, gate) in gates.iter().enumerate() {
        let agent = app.agent("worker", &format!("作業者{index}"));
        let channel = app.channel(&format!("部屋{index}"), &[&agent]);
        app.runtime.script(agent.id.as_str(), Script::Gate(gate.clone(), "完了".to_owned()));
        conversation.send_human_message(&channel.id, "お願い", &[]).unwrap();
    }
    tick().await;
    let activity = conversation.activity();
    assert_eq!(activity.activities.len(), 1);
    assert_eq!(activity.queues.iter().map(|queue| queue.pending).sum::<u32>(), 2);
    assert_eq!(app.runtime.requests.lock()[0].2.timeout_minutes, Some(30));

    let increased = RunLimits { timeout_minutes: Some(60), max_concurrent_jobs: Some(2) };
    conversation.set_run_limits(increased).await.unwrap();
    tick().await;
    assert_eq!(conversation.activity().activities.len(), 2);
    assert_eq!(app.runtime.requests.lock()[1].2.timeout_minutes, Some(60));

    conversation.set_run_limits(initial).await.unwrap();
    assert_eq!(conversation.run_limits().await.unwrap(), initial);
    assert_eq!(conversation.activity().activities.len(), 2);
    gates[0].notify_one();
    tick().await;
    assert_eq!(conversation.activity().activities.len(), 1);
    assert_eq!(app.runtime.requests.lock().len(), 2);

    conversation.set_run_limits(RunLimits::default()).await.unwrap();
    tick().await;
    assert_eq!(conversation.activity().activities.len(), 2);
    assert_eq!(app.runtime.requests.lock()[2].2.timeout_minutes, None);
    gates.iter().skip(1).for_each(|gate| gate.notify_one());
    app.settle().await;
}

#[tokio::test]
async fn invalid_limits_and_failed_writes_leave_the_applied_settings_as_they_were() {
    use std::sync::atomic::Ordering;

    let app = TestApp::new();
    let conversation = &app.services.conversation;
    let chosen = RunLimits { timeout_minutes: Some(120), max_concurrent_jobs: Some(10) };
    conversation.set_run_limits(chosen).await.unwrap();
    let invalid = RunLimits { timeout_minutes: Some(31), max_concurrent_jobs: Some(10) };
    assert!(conversation.set_run_limits(invalid).await.is_err());
    assert_eq!(app.settings.load().unwrap().run_limits, chosen);
    app.settings.fail_load.store(true, Ordering::SeqCst);
    assert!(conversation.set_run_limits(RunLimits::default()).await.is_err());
    assert_eq!(conversation.run_limits().await.unwrap(), chosen);
}

#[tokio::test]
async fn one_conversation_has_no_limit_on_the_number_of_replies() {
    let app = TestApp::new();
    let workers: Vec<_> = (0..20).map(|i| app.agent("worker", &format!("w{i}"))).collect();
    let lobby = app.channel("ロビー", &workers.iter().collect::<Vec<_>>());
    app.services.conversation.send_human_message(&lobby.id, "全員どうぞ", &[]).unwrap();
    app.settle().await;
    assert_eq!(app.runtime.requests.lock().len(), workers.len(), "全員が返答する");
    assert!(!app.transcript(&lobby).iter().any(|line| line.contains("上限")), "上限のお知らせは出ない");
}

#[tokio::test(start_paused = true)]
async fn an_unlimited_job_runs_past_24_hours_and_stop_releases_the_agent_for_the_next_job() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    app.runtime.script(haru.id.as_str(), Script::Hang);
    app.runtime.script(haru.id.as_str(), reply("次の作業は完了"));
    app.services.conversation.send_human_message(&lobby.id, "長い作業を", &[]).unwrap();
    tick().await;
    tokio::time::advance(Duration::from_secs(24 * 60 * 60)).await;
    tick().await;
    assert_eq!(app.transcript(&lobby), vec!["人間: 長い作業を"]);
    assert_eq!(app.services.conversation.activity().activities.len(), 1);
    assert!(app.runtime.cancelled.lock().is_empty());
    assert_eq!(app.runtime.requests_for(haru.id.as_str())[0].timeout_minutes, None);

    app.services.conversation.stop(&lobby.id).await.unwrap();
    app.settle().await;
    assert_eq!(app.runtime.cancelled.lock().len(), 1);
    app.services.conversation.send_human_message(&lobby.id, "次をお願い", &[]).unwrap();
    app.settle().await;
    assert_eq!(app.runtime.requests_for(haru.id.as_str()).len(), 2);
    assert_eq!(
        app.transcript(&lobby),
        vec!["人間: 長い作業を", "システム: 停止しました", "人間: 次をお願い", "ハル: 次の作業は完了"]
    );
    assert!(app.services.conversation.activity().activities.is_empty());
}
