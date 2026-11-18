//! 停止・削除・除外（design.md §9）: 終端を待ってからのお知らせ、世代による結果の破棄。

use std::sync::Arc;
use std::time::Duration;

use guild_domain::activity::ActivityState;
use guild_domain::author::MemberId;
use guild_domain::skill::SkillInput;
use tokio::sync::Notify;

use crate::support::runtime::{reply, Script};
use crate::support::TestApp;

async fn tick() {
    for _ in 0..20 {
        tokio::time::sleep(Duration::from_millis(1)).await;
    }
}

#[tokio::test]
async fn stop_cancels_the_running_job_drops_the_queue_and_then_announces() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let sora = app.agent("worker", "ソラ");
    let lobby = app.channel("ロビー", &[&haru, &sora]);
    app.runtime.script(haru.id.as_str(), Script::Hang);
    app.services.conversation.send_human_message(&lobby.id, "長い作業を", &[]).unwrap();
    tick().await;

    app.services.conversation.stop(&lobby.id).await.unwrap();
    app.settle().await;

    assert_eq!(app.transcript(&lobby), vec!["人間: 長い作業を", "システム: 停止しました"]);
    assert_eq!(app.runtime.cancelled.lock().len(), 1);
    assert!(app.runtime.requests_for(sora.id.as_str()).is_empty(), "待機していたジョブは破棄");
    assert_eq!(app.services.conversation.activity(), ActivityState::default());
}

#[tokio::test]
async fn stop_all_cancels_running_jobs_and_drops_pending_jobs_across_channels() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let sora = app.agent("worker", "ソラ");
    let kai = app.agent("worker", "カイ");
    let lobby = app.channel("ロビー", &[&haru, &kai]);
    let lab = app.channel("実験室", &[&sora]);
    app.runtime.script(haru.id.as_str(), Script::Hang);
    app.runtime.script(sora.id.as_str(), Script::Hang);
    let conversation = &app.services.conversation;
    conversation.send_human_message(&lobby.id, "ロビーで作業", &[]).unwrap();
    conversation.send_human_message(&lab.id, "実験室で作業", &[]).unwrap();
    tick().await;
    let started_ids: Vec<_> = app.runtime.requests.lock().iter().map(|(id, _, _)| id.clone()).collect();
    assert_eq!(started_ids.len(), 2);
    assert_eq!(conversation.activity().queues.iter().map(|queue| queue.pending).sum::<u32>(), 1);

    conversation.stop_all().await;

    let cancelled = app.runtime.cancelled.lock();
    assert_eq!(cancelled.len(), started_ids.len());
    assert!(started_ids.iter().all(|id| cancelled.contains(id)));
    assert!(app.runtime.requests_for(kai.id.as_str()).is_empty());
    assert_eq!(conversation.activity(), ActivityState::default());
    assert_eq!(app.transcript(&lobby), vec!["人間: ロビーで作業"]);
    assert_eq!(app.transcript(&lab), vec!["人間: 実験室で作業"]);
}

#[tokio::test]
async fn a_result_that_arrives_after_stop_is_discarded() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    let late = Arc::new(Notify::new());
    app.runtime.script(haru.id.as_str(), Script::Stubborn(late.clone(), "間に合わなかった返答".to_owned()));
    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    tick().await;

    let conversation = app.services.conversation.clone();
    let channel_id = lobby.id.clone();
    let stopping = tokio::spawn(async move { conversation.stop(&channel_id).await });
    tick().await;
    assert_eq!(app.transcript(&lobby), vec!["人間: お願い"], "終端までは「停止しました」を出さない");
    late.notify_one();
    stopping.await.unwrap().unwrap();
    app.settle().await;

    assert_eq!(app.transcript(&lobby), vec!["人間: お願い", "システム: 停止しました"]);
}

#[tokio::test(start_paused = true)]
async fn a_stop_wait_timeout_does_not_release_the_agents_workspace() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    let late = Arc::new(Notify::new());
    app.runtime.script(haru.id.as_str(), Script::Stubborn(late.clone(), "古い返答".to_owned()));
    app.runtime.script(haru.id.as_str(), reply("次の返答"));
    app.services.conversation.send_human_message(&lobby.id, "最初の依頼", &[]).unwrap();
    tick().await;

    let conversation = app.services.conversation.clone();
    let channel_id = lobby.id.clone();
    let stopping = tokio::spawn(async move { conversation.stop(&channel_id).await });
    tick().await;
    assert_eq!(app.runtime.cancelled.lock().len(), 1);
    tokio::time::advance(Duration::from_secs(31)).await;
    stopping.await.unwrap().unwrap();

    app.services.conversation.send_human_message(&lobby.id, "次の依頼", &[]).unwrap();
    tick().await;
    assert_eq!(app.runtime.requests_for(haru.id.as_str()).len(), 1);
    assert_eq!(app.transcript(&lobby), vec!["人間: 最初の依頼", "人間: 次の依頼"]);

    late.notify_one();
    app.settle().await;
    assert_eq!(app.runtime.requests_for(haru.id.as_str()).len(), 2);
    assert_eq!(
        app.transcript(&lobby),
        vec!["人間: 最初の依頼", "人間: 次の依頼", "システム: 停止しました", "ハル: 次の返答"]
    );
}

#[tokio::test]
async fn stopping_an_idle_channel_says_nothing() {
    let app = TestApp::new();
    let lobby = app.channel("ロビー", &[]);
    app.services.conversation.stop(&lobby.id).await.unwrap();
    assert!(app.transcript(&lobby).is_empty());
}

#[tokio::test]
async fn deleting_an_agent_discards_its_work_and_soft_deletes_it() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    let skill = SkillInput {
        id: None,
        agent_id: haru.id.clone(),
        name: "notes".to_owned(),
        description: "メモ".to_owned(),
        body: String::new(),
    };
    app.services.skills.save(skill).unwrap();
    let late = Arc::new(Notify::new());
    app.runtime.script(haru.id.as_str(), Script::Stubborn(late.clone(), "消えたはずの返答".to_owned()));
    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    tick().await;

    app.services.agents.delete(&haru.id).await.unwrap();
    late.notify_one();
    app.settle().await;

    assert_eq!(app.transcript(&lobby), vec!["人間: お願い"]);
    let snapshot = app.services.snapshot.get().unwrap();
    assert!(snapshot.agents.iter().any(|a| a.id == haru.id && a.deleted_at.is_some()), "削除済みも Snapshot に残る");
    assert!(!snapshot.channels[0].has_member(&MemberId::Agent(haru.id.clone())));
    assert!(app.store.skills.lock().is_empty());
    assert_eq!(*app.workspace.removed.lock(), vec![haru.id.clone()]);
    assert!(app.services.agents.update(&haru.id, crate::support::input("worker", "ハル")).is_err());
}

#[tokio::test]
async fn removing_a_member_discards_its_work_in_that_channel() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    let late = Arc::new(Notify::new());
    app.runtime.script(haru.id.as_str(), Script::Stubborn(late.clone(), "外されたあとの返答".to_owned()));
    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    tick().await;

    let member = MemberId::Agent(haru.id.clone());
    app.services.channels.remove_member(&lobby.id, &member).await.unwrap();
    late.notify_one();
    app.settle().await;

    assert_eq!(app.transcript(&lobby), vec!["人間: お願い"]);
}

#[tokio::test]
async fn deleting_a_channel_stops_it_and_removes_its_messages() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    app.runtime.script(haru.id.as_str(), Script::Hang);
    app.runtime.script(haru.id.as_str(), reply("別件"));
    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    tick().await;

    app.services.channels.delete(&lobby.id).await.unwrap();
    app.settle().await;

    assert!(app.store.messages.lock().is_empty());
    assert!(app.services.conversation.list_messages(&lobby.id, None, None).is_err());
}
