//! 割り振りの打ち切り（design.md §7.1-7・§9）: 停止・担当者の削除と除外・マネージャーの削除。

use std::sync::Arc;
use std::time::Duration;

use guild_domain::author::MemberId;
use guild_domain::delegation::{Delegation, DelegationStatus, SubtaskStatus, ASSIGNEE_REMOVED};
use tokio::sync::Notify;

use crate::support::records::statuses;
use crate::support::runtime::{reply, Script};
use crate::support::TestApp;

const SPLIT: &str = "```tasks\n@ハル: 調べて\n@ソラ: 作って\n```";

async fn tick() {
    for _ in 0..20 {
        tokio::time::sleep(Duration::from_millis(1)).await;
    }
}

fn delegation(app: &TestApp) -> Delegation {
    app.store.delegations.lock().first().cloned().unwrap_or_else(|| panic!("割り振りがありません"))
}

#[tokio::test]
async fn stopping_the_channel_cancels_the_delegation_and_its_subtasks() {
    let app = TestApp::new();
    let kaname = app.agent("manager", "カナメ");
    let haru = app.agent("worker", "ハル");
    let sora = app.agent("worker", "ソラ");
    let lobby = app.channel("ロビー", &[&kaname, &haru, &sora]);
    app.runtime.script(kaname.id.as_str(), reply(SPLIT));
    app.runtime.script(haru.id.as_str(), Script::Hang);
    app.runtime.script(sora.id.as_str(), Script::Hang);
    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    tick().await;

    app.services.conversation.stop(&lobby.id).await.unwrap();
    app.settle().await;

    let delegation = delegation(&app);
    assert_eq!(delegation.status, DelegationStatus::Cancelled);
    assert_eq!(statuses(&delegation), [SubtaskStatus::Cancelled, SubtaskStatus::Cancelled]);
    assert_eq!(app.runtime.cancelled.lock().len(), 2, "実行中の2人を中断");
    assert_eq!(app.runtime.requests_for(kaname.id.as_str()).len(), 1, "まとめは積まない");
    assert_eq!(app.transcript(&lobby).last().map(String::as_str), Some("システム: 停止しました"));
}

#[tokio::test]
async fn a_removed_assignee_fails_their_subtask_and_the_rest_still_reports() {
    let app = TestApp::new();
    let kaname = app.agent("manager", "カナメ");
    let haru = app.agent("worker", "ハル");
    let sora = app.agent("worker", "ソラ");
    let lobby = app.channel("ロビー", &[&kaname, &haru, &sora]);
    app.runtime.script(kaname.id.as_str(), reply(SPLIT));
    app.runtime.script(haru.id.as_str(), Script::Hang);
    app.runtime.script(sora.id.as_str(), reply("作りました"));
    app.runtime.script(kaname.id.as_str(), reply("ソラの分だけまとめます"));
    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    tick().await;

    app.services.agents.delete(&haru.id).await.unwrap();
    app.settle().await;

    let delegation = delegation(&app);
    assert_eq!(statuses(&delegation), [SubtaskStatus::Failed, SubtaskStatus::Done]);
    assert_eq!(delegation.subtasks[0].note.as_deref(), Some(ASSIGNEE_REMOVED));
    assert_eq!(delegation.status, DelegationStatus::Done);
    assert!(app.runtime.requests_for(kaname.id.as_str())[1].prompt.contains("理由: 担当者が外れました"));
}

#[tokio::test]
async fn removing_an_assignee_from_the_channel_fails_their_subtask() {
    let app = TestApp::new();
    let kaname = app.agent("manager", "カナメ");
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&kaname, &haru]);
    app.runtime.script(kaname.id.as_str(), reply("```tasks\n@ハル: 調べて\n```"));
    app.runtime.script(haru.id.as_str(), Script::Hang);
    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    tick().await;

    app.services.channels.remove_member(&lobby.id, &MemberId::Agent(haru.id.clone())).await.unwrap();
    app.settle().await;

    let delegation = delegation(&app);
    assert_eq!(delegation.subtasks[0].note.as_deref(), Some(ASSIGNEE_REMOVED));
    assert_eq!(delegation.status, DelegationStatus::Done, "全員決着したのでまとめに進み、[PASS] で done");
}

#[tokio::test]
async fn deleting_the_manager_cancels_the_delegation() {
    let app = TestApp::new();
    let kaname = app.agent("manager", "カナメ");
    let haru = app.agent("worker", "ハル");
    let sora = app.agent("worker", "ソラ");
    let lobby = app.channel("ロビー", &[&kaname, &haru, &sora]);
    let held = Arc::new(Notify::new());
    app.runtime.script(kaname.id.as_str(), reply(SPLIT));
    app.runtime.script(haru.id.as_str(), Script::Gate(held.clone(), "調べ終わりました".to_owned()));
    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    tick().await;

    app.services.agents.delete(&kaname.id).await.unwrap();
    held.notify_one();
    app.settle().await;

    let delegation = delegation(&app);
    assert_eq!(delegation.status, DelegationStatus::Cancelled);
    assert_eq!(delegation.subtasks[0].status, SubtaskStatus::Cancelled, "打ち切ったあとに届いた結果では変わらない");
    assert!(app.transcript(&lobby).contains(&"ハル: 調べ終わりました".to_owned()), "担当者の返答そのものは残る");
}
