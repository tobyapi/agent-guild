//! プロンプトに入れる発言（design.md §8）: 会話のあるジョブはその会話の発言（起点の発言は必ず入れる）。
//! 人間の発言に応えるときはチャンネルの最近の発言も合わせ、会話のない自発活動はチャンネルの最近の発言だけ。

use guild_application::ports::MessageRepository;
use guild_domain::agent::Agent;
use guild_domain::author::Author;
use guild_domain::channel::Channel;
use guild_domain::conversation::{JobMode, JobSpec};
use guild_domain::ids::MessageId;
use guild_domain::message::{Message, MessageKind, NewMessage};
use guild_domain::prompt::{HISTORY_LIMIT, PROGRESS_LIMIT, RECENT_CHANNEL_LIMIT};

use crate::support::runtime::reply;
use crate::support::TestApp;

fn new_message(channel: &Channel, id: &str, root: &str, content: &str) -> NewMessage {
    NewMessage {
        id: MessageId::new(id),
        channel_id: channel.id.clone(),
        author_id: Author::Human,
        content: content.to_owned(),
        attachments: Vec::new(),
        kind: MessageKind::Chat,
        mentions: Vec::new(),
        reply_to_id: None,
        root_id: MessageId::new(root),
        depth: 0,
        delegation_id: None,
        created_at: 0,
    }
}

fn insert(app: &TestApp, message: NewMessage) -> Message {
    MessageRepository::insert(app.store.as_ref(), message).unwrap_or_else(|error| panic!("{error}"))
}

/// 起点 root の会話に、振り分けをせずに発言を足す
fn put(app: &TestApp, channel: &Channel, id: &str, root: &str, content: &str) -> Message {
    insert(app, new_message(channel, id, root, content))
}

/// 起点 root の会話に、作業の途中の投稿を足す
fn put_progress(app: &TestApp, channel: &Channel, id: &str, root: &str, content: &str) -> Message {
    insert(app, NewMessage { kind: MessageKind::Progress, ..new_message(channel, id, root, content) })
}

/// そのエージェントへの最後の依頼の、「あなた宛ての未対応の発言」より前（プロンプトに入れた発言）
fn history_sent_to(app: &TestApp, agent: &Agent) -> String {
    let requests = app.runtime.requests_for(agent.id.as_str());
    let prompt = requests.last().map(|request| request.prompt.clone()).unwrap_or_default();
    prompt.split("# あなた宛ての未対応の発言").next().unwrap_or_default().to_owned()
}

#[tokio::test]
async fn a_reply_to_a_human_also_sees_the_recent_flow_of_the_channel() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    app.runtime.script(haru.id.as_str(), reply("返答回数の上限です"));
    app.runtime.script(haru.id.as_str(), reply("外しました"));
    let conversation = &app.services.conversation;
    conversation.send_human_message(&lobby.id, "@ハル 上限ってなに？", &[]).unwrap();
    app.settle().await;
    conversation.send_human_message(&lobby.id, "@ハル それを外して", &[]).unwrap();
    app.settle().await;
    let history = history_sent_to(&app, &haru);
    assert!(history.starts_with("# この会話と、チャンネル #ロビー の最近の発言"));
    assert!(
        history.contains("上限ってなに？") && history.contains("返答回数の上限です"),
        "直前の流れは別の会話でも送る"
    );
}

#[tokio::test]
async fn agents_talking_among_themselves_see_only_their_conversation() {
    let app = TestApp::new();
    let (haru, logica) = (app.agent("worker", "ハル"), app.agent("expert", "ロジカ"));
    let lobby = app.channel("ロビー", &[&haru, &logica]);
    app.runtime.script(haru.id.as_str(), reply("Aの返事"));
    app.runtime.script(haru.id.as_str(), reply("@ロジカ Bを見て"));
    app.runtime.script(logica.id.as_str(), reply("確認しました"));
    let conversation = &app.services.conversation;
    conversation.send_human_message(&lobby.id, "@ハル Aの話", &[]).unwrap();
    app.settle().await;
    conversation.send_human_message(&lobby.id, "@ハル Bの話", &[]).unwrap();
    app.settle().await;
    let history = history_sent_to(&app, &logica);
    assert!(history.starts_with("# この会話のこれまでの発言") && history.contains("Bの話"));
    assert!(!history.contains("Aの話") && !history.contains("Aの返事"), "エージェント同士なら別の会話の発言は送らない");
}

#[tokio::test]
async fn the_first_message_of_a_long_conversation_is_always_sent() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    put(&app, &lobby, "r", "r", "最初の依頼");
    let total = HISTORY_LIMIT + 5;
    let replies: Vec<Message> =
        (1..=total).map(|n| put(&app, &lobby, &format!("r{n}"), "r", &format!("返事{n}番"))).collect();
    let last = replies.last().unwrap();
    app.services.conversation.enqueue(vec![JobSpec::respond(haru.id.clone(), last, JobMode::Reply, Vec::new())]);
    app.settle().await;
    let history = history_sent_to(&app, &haru);
    assert!(history.contains("最初の依頼"), "起点の発言は必ず入れる");
    assert!(history.contains(&format!("返事{total}番")) && history.contains("返事6番"), "ほかは新しい方から30件");
    assert!(!history.contains("返事5番"));
}

#[tokio::test]
async fn an_autonomous_job_sees_only_the_latest_messages_of_the_channel() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    for n in 1..=RECENT_CHANNEL_LIMIT + 2 {
        put(&app, &lobby, &format!("m{n}"), &format!("m{n}"), &format!("話題{n}番"));
    }
    let job = JobSpec::autonomous(haru.id.clone(), lobby.id.clone());
    assert!(app.services.conversation.enqueue_autonomous(job).await);
    app.settle().await;
    let history = history_sent_to(&app, &haru);
    assert!(history.starts_with("# チャンネル #ロビー の最近の発言"));
    assert!(history.contains("話題3番") && !history.contains("話題2番"), "最近の10件だけ");
}

#[tokio::test]
async fn progress_posts_do_not_push_the_replies_out_of_the_history() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    put(&app, &lobby, "r", "r", "最初の依頼");
    put(&app, &lobby, "r1", "r", "大事な返事");
    let total = HISTORY_LIMIT + PROGRESS_LIMIT;
    for n in 1..=total {
        put_progress(&app, &lobby, &format!("p{n}"), "r", &format!("経過{n}番"));
    }
    let last = put(&app, &lobby, "r2", "r", "続けて");
    app.services.conversation.enqueue(vec![JobSpec::respond(haru.id.clone(), &last, JobMode::Reply, Vec::new())]);
    app.settle().await;
    let history = history_sent_to(&app, &haru);
    assert!(history.contains("大事な返事"), "途中の投稿は発言の件数に数えない");
    let oldest_kept = total - PROGRESS_LIMIT + 1;
    assert!(
        history.contains(&format!("（途中経過）:\n経過{total}番")) && history.contains(&format!("経過{oldest_kept}番"))
    );
    assert!(!history.contains(&format!("経過{}番", oldest_kept - 1)), "途中の投稿は新しい方から10件まで");
}

#[tokio::test]
async fn progress_posts_older_than_the_recent_messages_are_left_out() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    put_progress(&app, &lobby, "p1", "p1", "昔の経過");
    for n in 1..=RECENT_CHANNEL_LIMIT {
        put(&app, &lobby, &format!("m{n}"), &format!("m{n}"), &format!("話題{n}番"));
    }
    put_progress(&app, &lobby, "p2", "m1", "いまの経過");
    let job = JobSpec::autonomous(haru.id.clone(), lobby.id.clone());
    assert!(app.services.conversation.enqueue_autonomous(job).await);
    app.settle().await;
    let history = history_sent_to(&app, &haru);
    assert!(history.contains("話題1番") && history.contains("いまの経過"), "最近の発言の範囲にある途中の投稿は入れる");
    assert!(!history.contains("昔の経過"), "それより古い流れの途中の投稿は入れない");
}
