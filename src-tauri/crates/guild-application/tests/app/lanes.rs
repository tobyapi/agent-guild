//! 実行モデル（design.md §6）: レーンの中は会話ごとに直列。別の会話は同じチャンネルでも並行し、
//! 手の空いていないエージェントのジョブは、ほかの会話を止めない。

use std::sync::Arc;
use std::time::Duration;

use guild_domain::activity::ChannelQueue;
use tokio::sync::Notify;

use crate::support::runtime::{reply, Script};
use crate::support::TestApp;

/// アクターがコマンドを処理し終えるまで少し待つ
async fn tick() {
    for _ in 0..20 {
        tokio::time::sleep(Duration::from_millis(1)).await;
    }
}

/// 条件がそろうまで待つ（そろわなければ失敗にする）
async fn until(app: &TestApp, what: &str, done: impl Fn(&TestApp) -> bool) {
    for _ in 0..2_000 {
        if done(app) {
            return;
        }
        tokio::time::sleep(Duration::from_millis(1)).await;
    }
    panic!("{what}がそろいません: {:?}", app.services.conversation.activity());
}

fn gate() -> Arc<Notify> {
    Arc::new(Notify::new())
}

#[tokio::test]
async fn another_conversation_in_the_channel_runs_in_parallel() {
    let app = TestApp::new();
    let (haru, sora) = (app.agent("worker", "ハル"), app.agent("worker", "ソラ"));
    let lobby = app.channel("ロビー", &[&haru, &sora]);
    let (long, short) = (gate(), gate());
    app.runtime.script(sora.id.as_str(), Script::Gate(long.clone(), "実装しました".to_owned()));
    app.runtime.script(haru.id.as_str(), Script::Gate(short.clone(), "調べました".to_owned()));
    let conversation = &app.services.conversation;
    conversation.send_human_message(&lobby.id, "@ソラ 実装して", &[]).unwrap();
    tick().await;
    conversation.send_human_message(&lobby.id, "@ハル 調べて", &[]).unwrap();
    tick().await;
    assert_eq!(conversation.activity().activities.len(), 2, "別の会話は同じチャンネルでも並行して動く");
    short.notify_one();
    until(&app, "ハルの返答", |app| app.transcript(&lobby).len() == 3).await;
    long.notify_one();
    app.settle().await;
    assert_eq!(
        app.transcript(&lobby),
        vec!["人間: @ソラ 実装して", "人間: @ハル 調べて", "ハル: 調べました", "ソラ: 実装しました"]
    );
}

#[tokio::test]
async fn jobs_in_the_same_conversation_run_one_at_a_time() {
    let app = TestApp::new();
    let (haru, sora) = (app.agent("worker", "ハル"), app.agent("worker", "ソラ"));
    let lobby = app.channel("ロビー", &[&haru, &sora]);
    let first = gate();
    app.runtime.script(haru.id.as_str(), Script::Gate(first.clone(), "ハルの案".to_owned()));
    app.runtime.script(sora.id.as_str(), reply("ソラの案"));
    let conversation = &app.services.conversation;
    conversation.send_human_message(&lobby.id, "@ハル @ソラ 案をください", &[]).unwrap();
    tick().await;
    let queue = ChannelQueue { channel_id: lobby.id.clone(), running: 1, pending: 1 };
    assert_eq!(conversation.activity().queues, vec![queue], "同じ会話の中は順番に");
    first.notify_one();
    app.settle().await;
    assert_eq!(app.transcript(&lobby), vec!["人間: @ハル @ソラ 案をください", "ハル: ハルの案", "ソラ: ソラの案"]);
}

#[tokio::test]
async fn a_busy_agent_does_not_hold_up_other_conversations() {
    let app = TestApp::new();
    let (haru, sora) = (app.agent("worker", "ハル"), app.agent("worker", "ソラ"));
    let (lobby, lab) = (app.channel("ロビー", &[&haru, &sora]), app.channel("実験", &[&sora]));
    let busy = gate();
    app.runtime.script(sora.id.as_str(), Script::Gate(busy.clone(), "実験の結果".to_owned()));
    app.runtime.script(sora.id.as_str(), reply("ロビーへの返事"));
    app.runtime.script(haru.id.as_str(), reply("引き受けました"));
    let conversation = &app.services.conversation;
    conversation.send_human_message(&lab.id, "@ソラ 実験して", &[]).unwrap();
    tick().await;
    conversation.send_human_message(&lobby.id, "@ソラ 状況は？", &[]).unwrap();
    conversation.send_human_message(&lobby.id, "@ハル これお願い", &[]).unwrap();
    until(&app, "ハルの返答", |app| app.transcript(&lobby).len() == 3).await;
    assert_eq!(app.transcript(&lobby)[2], "ハル: 引き受けました", "手の空いていないソラの待ちに、ハルは並ばない");
    busy.notify_one();
    app.settle().await;
    assert_eq!(app.transcript(&lobby).last().map(String::as_str), Some("ソラ: ロビーへの返事"));
}
