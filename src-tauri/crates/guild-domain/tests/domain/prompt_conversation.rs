//! 会話プロンプト: 履歴・あなた宛ての未対応の発言・注記・モード別の指示。

use guild_domain::agent::{effective_permissions, Agent};
use guild_domain::attachment::NewAttachment;
use guild_domain::author::Author;
use guild_domain::conversation::{JobMode, JobSpec};
use guild_domain::ids::{AgentId, AttachmentId, ChannelId};
use guild_domain::message::Message;
use guild_domain::profile::Profile;
use guild_domain::prompt::{
    build_conversation_prompt, ConsultSource, PromptContext, MESSAGE_CHAR_LIMIT, TRIGGER_CHAR_LIMIT,
};

use super::support::{agent, by, channel, ids, message};

fn prompt_for(agent_id: &str, history: &[Message], job: &JobSpec, sources: &[ConsultSource]) -> String {
    let mut ghost = agent("ghost", "worker", "ゴースト");
    ghost.deleted_at = Some(1);
    let agents: Vec<Agent> = vec![agent("haru", "worker", "ハル"), agent("logica", "expert", "ロジカ"), ghost];
    let lobby = channel("c1", &["me", "haru", "logica"]);
    let me = Profile::default();
    let Some(subject) = agents.iter().find(|a| a.id.as_str() == agent_id) else {
        panic!("{agent_id} がいません");
    };
    let ctx = PromptContext {
        agent: subject,
        permissions: effective_permissions(subject, None),
        channel: &lobby,
        agents: &agents,
        backends: &[],
        me: &me,
        skills: &[],
        memory: "",
        now_label: "",
        time_label: &|ms| format!("t{ms}"),
        attachment_path: &|_, attachment| format!("/guild/attachments/c1/{}", attachment.file_name()),
        delegation: None,
    };
    build_conversation_prompt(&ctx, history, job, sources)
}

fn reply_job(agent_id: &str, trigger: &Message, return_to: &[&str]) -> JobSpec {
    JobSpec::respond(AgentId::new(agent_id), trigger, JobMode::Reply, ids(return_to))
}

#[test]
fn shows_an_empty_history_and_the_autonomous_instruction() {
    let job = JobSpec::autonomous(AgentId::new("haru"), ChannelId::new("c1"));
    let prompt = prompt_for("haru", &[], &job, &[]);
    assert!(
        prompt.contains("# チャンネル #ロビー の最近の発言\n（まだ会話はありません）"),
        "自発活動はチャンネルの発言"
    );
    assert!(!prompt.contains("あなた宛ての未対応の発言"));
    assert!(prompt.contains("# 自由時間の過ごし方\nいまは自由時間です"));
    assert!(prompt.contains("作業場所にメモや下書きを作り"));
}

#[test]
fn tells_which_messages_the_attached_images_and_files_belong_to() {
    let mut human = message(1, Author::Human, "このエラーを見て");
    let png = NewAttachment { name: "a.png".to_owned(), media_type: "image/png".to_owned(), bytes: vec![1] };
    human.attachments = vec![png.describe(AttachmentId::new("i1")), png.describe(AttachmentId::new("i2"))];
    let images_only = prompt_for("haru", std::slice::from_ref(&human), &reply_job("haru", &human, &[]), &[]);
    assert!(images_only.contains("（画像 2 枚）:\nこのエラーを見て"), "{images_only}");
    assert!(!images_only.contains("# 添付ファイル"));
    let pdf =
        NewAttachment { name: "仕様.pdf".to_owned(), media_type: "application/pdf".to_owned(), bytes: vec![1; 2048] };
    human.attachments.push(pdf.describe(AttachmentId::new("f1")));
    let prompt = prompt_for("haru", std::slice::from_ref(&human), &reply_job("haru", &human, &[]), &[]);
    assert!(prompt.contains("（画像 2 枚・ファイル 1 個）:\nこのエラーを見て"), "{prompt}");
    assert!(prompt.contains("# 添付画像\nこの依頼には、次の発言に貼られた画像を添えています（添えた順）。"));
    assert!(prompt.contains("の発言: 2 枚"), "画像の枚数にファイルは数えない");
    assert!(prompt
        .contains("# 添付ファイル\n次の発言にファイルが添えられています。内容が必要なら、このパスから読んでください"));
    assert!(prompt.contains("の発言: 仕様.pdf（2.0 KB）\n  /guild/attachments/c1/f1.pdf"), "{prompt}");
    let plain = message(2, Author::Human, "こんにちは");
    let prompt = prompt_for("haru", std::slice::from_ref(&plain), &reply_job("haru", &plain, &[]), &[]);
    assert!(!prompt.contains("# 添付") && !prompt.contains("（画像"));
}

#[test]
fn labels_each_speaker_with_the_time() {
    let mut human = message(1, Author::Human, "こんにちは");
    human.created_at = 42;
    let history = vec![
        human.clone(),
        message(2, by("haru"), "やあ"),
        message(3, by("ghost"), "さようなら"),
        message(4, Author::System, "ロジカ がチャンネルに参加しました"),
    ];
    let prompt = prompt_for("haru", &history, &reply_job("haru", &human, &[]), &[]);
    assert!(prompt.contains("[t42] ユーザー（人間）:\nこんにちは"));
    assert!(prompt.contains("ハル（あなた自身）:\nやあ"));
    assert!(prompt.contains("ゴースト（退出したメンバー）:\nさようなら"));
    assert!(prompt.contains("システム:\nロジカ がチャンネルに参加しました"));
}

#[test]
fn quotes_the_triggers_in_full_up_to_8000_chars() {
    let long = "あ".repeat(TRIGGER_CHAR_LIMIT - 1);
    let trigger = message(1, Author::Human, &long);
    let prompt = prompt_for("haru", std::slice::from_ref(&trigger), &reply_job("haru", &trigger, &[]), &[]);
    let pending = format!("# あなた宛ての未対応の発言\n[t0] ユーザー（人間）:\n{long}\n");
    assert!(prompt.contains(&pending), "未対応の発言は全文");
    assert!(prompt.contains(&format!("{}\n…（長いので省略）", "あ".repeat(MESSAGE_CHAR_LIMIT))), "履歴は3000字まで");
    assert!(prompt.ends_with("上の「あなた宛ての未対応の発言」に、ハル として返答してください。"));
    assert!(!prompt.contains("最後の発言"));
}

#[test]
fn a_consultation_names_the_caller_and_their_readable_workspace() {
    let ask = message(2, by("haru"), "@ロジカ 見てください");
    let source = ConsultSource { name: "ハル".to_owned(), path: "C:\\data\\agents\\haru\\work".to_owned() };
    let prompt = prompt_for("logica", std::slice::from_ref(&ask), &reply_job("logica", &ask, &["haru"]), &[source]);
    assert!(prompt.contains("これは ハル からの相談です"));
    assert!(prompt.contains("返事のためのメンションは要りません"));
    assert!(prompt.contains("ハル の作業場所（読み取りのみ）: C:\\data\\agents\\haru\\work"));
}

#[test]
fn return_mode_shows_notes_and_asks_to_continue() {
    let mut job = JobSpec::autonomous(AgentId::new("haru"), ChannelId::new("c1"));
    job.mode = JobMode::Return;
    job.notes.push("ロジカ は回答しませんでした".to_owned());
    let prompt = prompt_for("haru", &[], &job, &[]);
    assert!(prompt.contains("# 注記\n- ロジカ は回答しませんでした"));
    assert!(prompt.contains("# 相談の結果が届きました"));
    assert!(prompt.contains("元の作業を続けてください"));
}

#[test]
fn autonomous_ideas_follow_the_effective_permissions() {
    let job = JobSpec::autonomous(AgentId::new("logica"), ChannelId::new("c1"));
    let prompt = prompt_for("logica", &[], &job, &[]);
    assert!(!prompt.contains("Webで最近の話題"));
    assert!(prompt.contains("作業場所にメモや下書きを作り"));
    let worker = JobSpec::autonomous(AgentId::new("haru"), ChannelId::new("c1"));
    assert!(prompt_for("haru", &[], &worker, &[]).contains("Webで最近の話題"));
}
