//! 実行モデル（design.md §6）: 合流・エージェント単位の排他・全体の上限・1つの会話の返答回数に上限がないこと・時間切れ。

use std::sync::Arc;
use std::time::Duration;

use guild_application::conversation::{JOB_TIMEOUT, MAX_CONCURRENT_JOBS};
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
async fn at_most_three_jobs_run_at_once() {
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
    assert_eq!(activity.activities.len(), MAX_CONCURRENT_JOBS);
    assert_eq!(activity.queues.iter().map(|q| q.pending).sum::<u32>(), 1);
    gates.iter().for_each(|gate| gate.notify_one());
    app.settle().await;
    assert_eq!(app.runtime.requests.lock().len(), 4);
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
async fn a_job_times_out_after_fifteen_minutes() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let logica = app.agent("expert", "ロジカ");
    let lobby = app.channel("ロビー", &[&haru, &logica]);
    app.runtime.script(haru.id.as_str(), reply("@ロジカ 見て"));
    app.runtime.script(logica.id.as_str(), Script::Hang);
    app.runtime.script(haru.id.as_str(), reply("待ちきれませんでした"));
    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    tick().await;
    tokio::time::advance(JOB_TIMEOUT + Duration::from_secs(1)).await;
    app.settle().await;
    assert_eq!(
        app.transcript(&lobby),
        vec![
            "人間: お願い",
            "ハル: @ロジカ 見て",
            "ロジカ: 時間切れで中断しました（15分）",
            "ハル: 待ちきれませんでした"
        ]
    );
    assert_eq!(app.runtime.cancelled.lock().len(), 1, "時間切れのジョブは中断を送る");
    assert!(app.runtime.requests_for(haru.id.as_str())[1].prompt.contains("ロジカ は失敗しました"));
}
