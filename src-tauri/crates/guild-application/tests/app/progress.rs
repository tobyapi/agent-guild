//! 作業の途中の投稿: 返答と同じ会話の位置に kind=progress で保存し、振り分けない。止めたチャンネルの投稿は捨てる。

use std::sync::Arc;
use std::time::Duration;

use guild_domain::message::MessageKind;
use tokio::sync::Notify;

use crate::support::runtime::Script;
use crate::support::TestApp;

async fn tick() {
    for _ in 0..20 {
        tokio::time::sleep(Duration::from_millis(1)).await;
    }
}

#[tokio::test]
async fn progress_posts_are_saved_before_the_reply_and_never_routed() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let logica = app.agent("expert", "ロジカ");
    let lobby = app.channel("ロビー", &[&haru, &logica]);
    let posts = ["進捗: 半分まで調べました", "ハル: @ロジカ ここで迷っています", "[PASS]", "  "];
    let posts = posts.iter().map(|post| (*post).to_owned()).collect();
    app.runtime.script(haru.id.as_str(), Script::Posts(posts, "まとめました。".to_owned()));

    app.services.conversation.send_human_message(&lobby.id, "@ハル 調べて", &[]).unwrap();
    app.settle().await;

    assert_eq!(
        app.transcript(&lobby),
        vec!["人間: @ハル 調べて", "ハル: 進捗: 半分まで調べました", "ハル: @ロジカ ここで迷っています", "ハル: まとめました。"],
        "空の投稿と [PASS] は捨て、名前の接頭辞は外す"
    );
    let messages = app.messages(&lobby);
    let kinds: Vec<MessageKind> = messages.iter().map(|m| m.kind).collect();
    assert_eq!(kinds, vec![MessageKind::Chat, MessageKind::Progress, MessageKind::Progress, MessageKind::Chat]);
    assert!(messages.iter().all(|m| m.root_id == messages[0].id), "返答と同じ会話");
    assert_eq!((messages[1].depth, messages[1].reply_to_id.clone()), (messages[3].depth, Some(messages[0].id.clone())));
    assert!(messages[2].mentions.is_empty(), "途中の投稿のメンションは記録しない");
    assert!(app.runtime.requests_for(logica.id.as_str()).is_empty(), "途中の投稿のメンションでは呼ばれない");
    assert_eq!(app.events.messages.lock().len(), 4, "途中の投稿も message-created で流れる");
}

#[tokio::test]
async fn posts_arriving_after_the_channel_was_stopped_are_dropped() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    let late = Arc::new(Notify::new());
    app.runtime.script(haru.id.as_str(), Script::LatePost(late.clone(), "止められたあとの投稿".to_owned()));
    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    tick().await;

    let conversation = app.services.conversation.clone();
    let channel_id = lobby.id.clone();
    let stopping = tokio::spawn(async move { conversation.stop(&channel_id).await });
    tick().await;
    late.notify_one();
    stopping.await.unwrap().unwrap();
    app.settle().await;

    assert_eq!(app.transcript(&lobby), vec!["人間: お願い", "システム: 停止しました"]);
}
