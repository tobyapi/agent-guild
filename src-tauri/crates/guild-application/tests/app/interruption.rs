//! 終了で中断された返答の知らせ（design.md §6）: 待機と実行中のジョブの要約を記録しておき、次の起動で会話ごとに知らせる。

use std::time::Duration;

use crate::support::runtime::{reply, Script};
use crate::support::TestApp;

/// 要約を置く meta の鍵
const KEY: &str = "interrupted_jobs";

/// アクターがコマンドを処理し終えるまで少し待つ
async fn tick() {
    for _ in 0..20 {
        tokio::time::sleep(Duration::from_millis(1)).await;
    }
}

fn notice(names: &str) -> String {
    format!(
        "システム: 前回アプリが終了したときに、{names}の返答が中断されました。続けるには、もう一度話しかけてください。"
    )
}

fn recorded(app: &TestApp) -> Option<String> {
    app.store.meta.lock().get(KEY).cloned()
}

#[tokio::test]
async fn replies_cut_off_by_the_last_exit_are_announced_per_conversation() {
    let app = TestApp::new();
    let (haru, sora) = (app.agent("worker", "ハル"), app.agent("worker", "ソラ"));
    let lobby = app.channel("ロビー", &[&haru, &sora]);
    app.runtime.script(haru.id.as_str(), Script::Hang);
    let conversation = &app.services.conversation;
    conversation.send_human_message(&lobby.id, "@ハル @ソラ 二人で調べて", &[]).unwrap();
    conversation.send_human_message(&lobby.id, "@ソラ 別件もお願い", &[]).unwrap();
    tick().await;
    assert!(recorded(&app).is_some_and(|summary| summary != "[]"), "実行中と待機中のジョブを記録する");
    let restarted = app.restart();
    assert_eq!(
        restarted.transcript(&lobby),
        vec![
            "人間: @ハル @ソラ 二人で調べて".to_owned(),
            "人間: @ソラ 別件もお願い".to_owned(),
            notice("ハル・ソラ"),
            notice("ソラ"),
        ],
        "待っていたソラは、合流した2つの会話の両方で知らせる"
    );
    assert_eq!(recorded(&restarted).as_deref(), Some("[]"), "知らせたら記録を消す");
}

#[tokio::test]
async fn nothing_is_announced_when_no_reply_was_left() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    app.runtime.script(haru.id.as_str(), reply("どうぞ"));
    app.services.conversation.send_human_message(&lobby.id, "@ハル お願い", &[]).unwrap();
    app.settle().await;
    assert_eq!(recorded(&app).as_deref(), Some("[]"), "終わったジョブは記録から消える");
    let restarted = app.restart();
    assert_eq!(restarted.transcript(&lobby), vec!["人間: @ハル お願い", "ハル: どうぞ"]);
}

#[tokio::test]
async fn stopped_replies_are_not_announced() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    app.runtime.script(haru.id.as_str(), Script::Hang);
    app.services.conversation.send_human_message(&lobby.id, "@ハル お願い", &[]).unwrap();
    tick().await;
    app.services.conversation.stop(&lobby.id).await.unwrap();
    app.settle().await;
    assert_eq!(recorded(&app).as_deref(), Some("[]"), "停止で取り消したジョブは記録しない");
    let restarted = app.restart();
    assert!(!restarted.transcript(&lobby).iter().any(|line| line.contains("中断されました")));
}
