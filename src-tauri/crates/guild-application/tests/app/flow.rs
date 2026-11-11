//! 会話の一連の流れ（design.md §7）: 人間 → 作業者 → 専門家への相談 → 回答 → 作業者に戻る。

use std::path::PathBuf;

use guild_domain::activity::ActivityState;

use crate::support::runtime::{reply, Script};
use crate::support::TestApp;

#[tokio::test]
async fn a_consultation_goes_to_the_expert_and_comes_back() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let logica = app.agent("expert", "ロジカ");
    let lobby = app.channel("ロビー", &[&haru]);
    app.runtime.script(haru.id.as_str(), reply("3案です。@ロジカ 見てもらえますか？"));
    app.runtime.script(logica.id.as_str(), reply("ロジカ: ⚠️ 要修正 3案目が曖昧です。@ハル"));
    app.runtime.script(haru.id.as_str(), reply("直しました。"));

    app.services.conversation.send_human_message(&lobby.id, "勉強会のテーマを考えて", &[]).unwrap();
    app.settle().await;

    assert_eq!(
        app.transcript(&lobby),
        vec![
            "人間: 勉強会のテーマを考えて",
            "ハル: 3案です。@ロジカ 見てもらえますか？",
            "システム: ロジカ がチャンネルに参加しました",
            "ロジカ: ⚠️ 要修正 3案目が曖昧です。@ハル",
            "ハル: 直しました。",
        ]
    );
    let messages = app.messages(&lobby);
    assert!(messages.iter().all(|m| m.root_id == messages[0].id), "全員が同じ起点");
    assert_eq!(messages.iter().map(|m| m.depth).collect::<Vec<_>>(), vec![0, 1, 1, 2, 3]);
    assert_eq!(messages[3].reply_to_id, Some(messages[1].id.clone()));

    let consult = &app.runtime.requests_for(logica.id.as_str())[0];
    let haru_work = PathBuf::from("/ws").join(haru.id.as_str()).join("work");
    assert_eq!(consult.readable_dirs, vec![haru_work]);
    assert!(consult.prompt.contains("これは ハル からの相談です"));
    assert!(consult.permissions.write_files && !consult.permissions.write_anywhere, "専門家は作業フォルダにだけ書く");
    let back = &app.runtime.requests_for(haru.id.as_str())[1];
    assert!(back.prompt.contains("# 相談の結果が届きました"));
    assert!(back.prompt.contains("⚠️ 要修正"));
    assert_eq!(app.events.messages.lock().len(), 5, "人間の発言も message-created で流れる");
    assert_eq!(app.services.conversation.activity(), ActivityState::default());
}

#[tokio::test]
async fn a_silent_consultant_hands_the_turn_back_with_a_note() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let logica = app.agent("expert", "ロジカ");
    let lobby = app.channel("ロビー", &[&haru, &logica]);
    app.runtime.script(haru.id.as_str(), reply("@ロジカ 確認して"));
    app.runtime.script(logica.id.as_str(), reply("[PASS]"));
    app.runtime.script(haru.id.as_str(), reply("このまま進めます"));

    app.services.conversation.send_human_message(&lobby.id, "進めて", &[]).unwrap();
    app.settle().await;

    assert_eq!(app.transcript(&lobby), vec!["人間: 進めて", "ハル: @ロジカ 確認して", "ハル: このまま進めます"]);
    let back = &app.runtime.requests_for(haru.id.as_str())[1];
    assert!(back.prompt.contains("# 注記\n- ロジカ は回答しませんでした"));
}

#[tokio::test]
async fn a_failed_consultation_leaves_an_error_and_returns_with_a_note() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let logica = app.agent("expert", "ロジカ");
    let lobby = app.channel("ロビー", &[&haru, &logica]);
    app.runtime.script(haru.id.as_str(), reply("@ロジカ 見て"));
    app.runtime.script(logica.id.as_str(), Script::Fail("Claude の認証がありません".to_owned()));
    app.runtime.script(haru.id.as_str(), reply("あとで聞き直します"));

    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    app.settle().await;

    assert_eq!(
        app.transcript(&lobby),
        vec!["人間: お願い", "ハル: @ロジカ 見て", "ロジカ: Claude の認証がありません", "ハル: あとで聞き直します"]
    );
    assert_eq!(app.messages(&lobby)[2].kind, guild_domain::message::MessageKind::Error);
    assert!(app.runtime.requests_for(haru.id.as_str())[1].prompt.contains("ロジカ は失敗しました"));
}

#[tokio::test]
async fn unmentioned_messages_go_to_every_worker_in_creation_order() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let logica = app.agent("expert", "ロジカ");
    let sora = app.agent("worker", "ソラ");
    let lobby = app.channel("ロビー", &[&sora, &logica, &haru]);
    app.runtime.script(haru.id.as_str(), reply("ハルです"));
    app.runtime.script(sora.id.as_str(), reply("ソラだ"));

    app.services.conversation.send_human_message(&lobby.id, "おはよう", &[]).unwrap();
    app.settle().await;

    assert_eq!(app.transcript(&lobby), vec!["人間: おはよう", "ハル: ハルです", "ソラ: ソラだ"]);
    assert!(app.runtime.requests_for(logica.id.as_str()).is_empty(), "作業者がいれば専門家は答えない");
}

#[tokio::test]
async fn says_so_when_no_backend_is_ready() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    app.runtime.backends.lock().clear();

    app.services.conversation.send_human_message(&lobby.id, "だれか", &[]).unwrap();
    app.settle().await;

    let last = app.transcript(&lobby).pop().unwrap_or_default();
    assert!(last.starts_with("システム: いま返答できるエージェントがいません"), "{last}");
}

#[tokio::test]
async fn an_ideator_waits_for_a_request_and_returns_ideas_to_the_worker() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let ideator = app.agent("ideator", "ヒラメ");
    let lobby = app.channel("ロビー", &[&haru, &ideator]);
    app.runtime.script(haru.id.as_str(), reply("調べて試します。"));
    app.services.conversation.send_human_message(&lobby.id, "進めて", &[]).unwrap();
    app.settle().await;
    assert!(app.runtime.requests_for(ideator.id.as_str()).is_empty(), "発想役は自動で割り込まない");

    app.runtime.script(haru.id.as_str(), reply("@ヒラメ 別の切り口で3案考えて"));
    app.runtime.script(ideator.id.as_str(), reply("違う切り口の3案です。"));
    app.runtime.script(haru.id.as_str(), reply("案を選んで制作を続けます。"));
    app.services.conversation.send_human_message(&lobby.id, "ほかの可能性も検討して", &[]).unwrap();
    app.settle().await;
    let requests = app.runtime.requests_for(ideator.id.as_str());
    assert_eq!(requests.len(), 1);
    assert!(requests[0].system_prompt.contains("基本の役割: 目的に合う複数のアイデア"));
    assert!(requests[0].system_prompt.contains("発想・企画の依頼には、異なる切り口の候補を複数"));
    assert!(!requests[0].permissions.write_anywhere && !requests[0].permissions.web_fetch);
    assert!(app.runtime.requests_for(haru.id.as_str()).last().unwrap().prompt.contains("# 相談の結果が届きました"));
    assert_eq!(app.transcript(&lobby).last().unwrap(), "ハル: 案を選んで制作を続けます。");
}
