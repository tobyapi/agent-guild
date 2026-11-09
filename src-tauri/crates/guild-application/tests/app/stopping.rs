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
    let skill = SkillInput { id: None, agent_id: haru.id.clone(), name: "notes".to_owned(), description: "メモ".to_owned(), body: String::new() };
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
