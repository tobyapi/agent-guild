//! 割り振り（design.md §7.1）: lead の段・サブタスクの並行実行・相談中の待ち・待ち合わせとまとめ。

use std::sync::Arc;
use std::time::Duration;

use guild_domain::delegation::{Delegation, DelegationStatus, SubtaskStatus, NO_ANSWER, RUN_FAILED};
use guild_domain::message::Message;
use tokio::sync::Notify;

use crate::support::records::statuses;
use crate::support::runtime::{reply, Script};
use crate::support::TestApp;

const SPLIT: &str = "2つに分けます。\n\n```tasks\n@ハル: 競合を調べて\n@ソラ: 試作を作って\n```";

async fn tick() {
    for _ in 0..20 {
        tokio::time::sleep(Duration::from_millis(1)).await;
    }
}

fn gate() -> Arc<Notify> {
    Arc::new(Notify::new())
}

fn only_delegation(app: &TestApp) -> Delegation {
    let delegations = app.store.delegations.lock();
    assert_eq!(delegations.len(), 1, "割り振りは1つ");
    delegations[0].clone()
}

fn message_with(app: &TestApp, content: &str) -> Message {
    let messages = app.store.messages.lock();
    messages.iter().find(|m| m.content == content).cloned().unwrap_or_else(|| panic!("「{content}」がありません"))
}

#[tokio::test]
async fn the_lead_splits_the_work_subtasks_run_together_and_the_report_comes_once() {
    let app = TestApp::new();
    let kaname = app.agent("manager", "カナメ");
    let haru = app.agent("worker", "ハル");
    let sora = app.agent("worker", "ソラ");
    let lobby = app.channel("ロビー", &[&kaname, &haru, &sora]);
    let (first, second) = (gate(), gate());
    app.runtime.script(kaname.id.as_str(), reply(SPLIT));
    app.runtime.script(haru.id.as_str(), Script::Gate(first.clone(), "競合は3つです".to_owned()));
    app.runtime.script(sora.id.as_str(), Script::Gate(second.clone(), "試作のビルドが通りました".to_owned()));
    app.runtime.script(kaname.id.as_str(), reply("まとめ: 調査と試作が終わりました"));

    app.services.conversation.send_human_message(&lobby.id, "新しいアプリの下調べと試作をお願い", &[]).unwrap();
    tick().await;
    let running: Vec<String> =
        app.services.conversation.activity().activities.iter().map(|a| a.agent_id.to_string()).collect();
    assert!(
        running.contains(&haru.id.to_string()) && running.contains(&sora.id.to_string()),
        "2人が同時に動く: {running:?}"
    );
    assert_eq!(statuses(&only_delegation(&app)), [SubtaskStatus::Running, SubtaskStatus::Running]);
    assert!(app.runtime.requests_for(haru.id.as_str())[0]
        .prompt
        .contains("カナメ から割り振られたタスクです:\n> 競合を調べて"));
    second.notify_one();
    first.notify_one();
    app.settle().await;

    let delegation = only_delegation(&app);
    assert_eq!(delegation.status, DelegationStatus::Done);
    assert_eq!(statuses(&delegation), [SubtaskStatus::Done, SubtaskStatus::Done]);
    assert_eq!(delegation.subtasks[0].result_message_id, Some(message_with(&app, "競合は3つです").id));
    assert_eq!(delegation.summary_message_id, Some(message_with(&app, "まとめ: 調査と試作が終わりました").id));
    assert_eq!(message_with(&app, SPLIT).delegation_id, Some(delegation.id.clone()), "tasks ブロックの発言に結びつく");
    let manager_runs = app.runtime.requests_for(kaname.id.as_str());
    assert_eq!(manager_runs.len(), 2, "受け付けとまとめの2回だけ（まとめは1回）");
    let report = &manager_runs[1].prompt;
    assert!(
        report.contains("# 割り振ったタスクの結果がそろいました")
            && report.contains("競合は3つです")
            && report.contains("試作のビルドが通りました")
    );
    assert!(
        app.runtime.requests_for(haru.id.as_str()).len() == 1,
        "lead がいれば answer の人はメンションなしの発言に答えない"
    );
    let last = app.events.delegations.lock().last().cloned();
    assert_eq!(last.map(|d| d.status), Some(DelegationStatus::Done), "最後の delegation-changed は done");
}

#[tokio::test]
async fn a_consulting_assignee_stays_running_until_the_answer_comes_back() {
    let app = TestApp::new();
    let kaname = app.agent("manager", "カナメ");
    let haru = app.agent("worker", "ハル");
    let logica = app.agent("expert", "ロジカ");
    let lobby = app.channel("ロビー", &[&kaname, &haru]);
    app.runtime.script(kaname.id.as_str(), reply("```tasks\n@ハル: 企画書を直して\n```"));
    app.runtime.script(haru.id.as_str(), reply("直しました。@ロジカ 論理を確認して"));
    app.runtime.script(logica.id.as_str(), reply("筋は通っています"));
    app.runtime.script(haru.id.as_str(), reply("確認済みの企画書です"));
    app.runtime.script(kaname.id.as_str(), reply("まとめました"));

    app.services.conversation.send_human_message(&lobby.id, "企画書をお願い", &[]).unwrap();
    app.settle().await;

    let delegation = only_delegation(&app);
    assert_eq!(
        delegation.subtasks[0].result_message_id,
        Some(message_with(&app, "確認済みの企画書です").id),
        "戻りで done"
    );
    let changes = app.events.delegations.lock().clone();
    let consulted = message_with(&app, "直しました。@ロジカ 論理を確認して").id;
    assert!(
        changes.iter().all(|d| d.subtasks[0].result_message_id.as_ref() != Some(&consulted)),
        "相談した返答では決着しない"
    );
    assert_eq!(delegation.status, DelegationStatus::Done);
    assert_eq!(app.runtime.requests_for(kaname.id.as_str()).len(), 2);
    assert!(app.runtime.requests_for(logica.id.as_str())[0].prompt.contains("これは ハル からの相談です"));
}

#[tokio::test]
async fn failures_settle_subtasks_and_the_report_still_comes_once() {
    let app = TestApp::new();
    let kaname = app.agent("manager", "カナメ");
    let haru = app.agent("worker", "ハル");
    let sora = app.agent("worker", "ソラ");
    let lobby = app.channel("ロビー", &[&kaname, &haru, &sora]);
    app.runtime.script(kaname.id.as_str(), reply(SPLIT));
    app.runtime.script(haru.id.as_str(), reply("[PASS]"));
    app.runtime.script(sora.id.as_str(), Script::Fail("認証がありません".to_owned()));
    app.runtime.script(kaname.id.as_str(), reply("[PASS]"));

    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    app.settle().await;

    let delegation = only_delegation(&app);
    assert_eq!(statuses(&delegation), [SubtaskStatus::Failed, SubtaskStatus::Failed]);
    assert_eq!(delegation.subtasks[0].note.as_deref(), Some(NO_ANSWER));
    assert_eq!(delegation.subtasks[1].note.as_deref(), Some(RUN_FAILED));
    assert_eq!(delegation.subtasks[1].result_message_id, Some(message_with(&app, "認証がありません").id));
    assert_eq!(
        (delegation.status, delegation.summary_message_id),
        (DelegationStatus::Done, None),
        "まとめが [PASS] でも done"
    );
    let manager_runs = app.runtime.requests_for(kaname.id.as_str());
    assert_eq!(manager_runs.len(), 2);
    assert!(manager_runs[1].prompt.contains("理由: 回答がありませんでした"));
}

#[tokio::test]
async fn unassignable_names_are_reported_and_outsiders_join_to_work() {
    let app = TestApp::new();
    let kaname = app.agent("manager", "カナメ");
    let logica = app.agent("expert", "ロジカ");
    let lobby = app.channel("ロビー", &[&kaname]);
    app.runtime
        .script(kaname.id.as_str(), reply("```tasks\n@だれか: 何か\n@カナメ: 自分で\n@ロジカ: レビューして\n```"));
    app.runtime.script(logica.id.as_str(), reply("レビューしました"));
    app.runtime.script(kaname.id.as_str(), reply("まとめ"));

    app.services.conversation.send_human_message(&lobby.id, "レビューを", &[]).unwrap();
    app.settle().await;

    let transcript = app.transcript(&lobby);
    assert!(transcript
        .contains(&"システム: だれか・カナメ には割り振れませんでした（見つからないか、自分自身です）".to_owned()));
    assert!(transcript.contains(&"システム: ロジカ がチャンネルに参加しました".to_owned()));
    assert!(transcript.contains(&"ロジカ: レビューしました".to_owned()));
    assert_eq!(only_delegation(&app).subtasks.len(), 1);
    assert_eq!(app.services.conversation.list_delegations(&lobby.id).unwrap().len(), 1);
}

#[tokio::test]
async fn a_tasks_block_from_an_agent_who_cannot_delegate_is_just_text() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let sora = app.agent("worker", "ソラ");
    let lobby = app.channel("ロビー", &[&haru, &sora]);
    app.runtime.script(haru.id.as_str(), reply("```tasks\n@ソラ: 作って\n```"));
    app.services.conversation.send_human_message(&lobby.id, "@ハル お願い", &[]).unwrap();
    app.settle().await;
    assert!(app.store.delegations.lock().is_empty());
    assert!(app.runtime.requests_for(sora.id.as_str()).is_empty(), "ブロックの中はメンションにもならない");
}
