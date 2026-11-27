//! 指示文の大きさの計測: 同じ固定入力から、節ごとの文字数（Unicode の文字数と UTF-16 単位）を出す。
//! `cargo test -p guild-domain --test domain prompt_size -- --nocapture` で表を表示する。

use guild_domain::agent::{effective_permissions, Agent};
use guild_domain::author::Author;
use guild_domain::conversation::{JobMode, JobSpec};
use guild_domain::delegation::{Delegation, DelegationStatus, Subtask, SubtaskRef, SubtaskStatus};
use guild_domain::ids::{AgentId, ChannelId, DelegationId, MessageId, SubtaskId};
use guild_domain::locale::Language;
use guild_domain::message::{Message, MessageKind};
use guild_domain::profile::Profile;
use guild_domain::prompt::{build_conversation_prompt, build_system_prompt, PromptContext};
use guild_domain::voice::{VoiceIntensity, VoiceSettings};

use super::support::{agent, backend, by, channel, message};

pub struct Sizes {
    pub voice: usize,
    pub system: usize,
    pub system_utf16: usize,
    pub history: usize,
    pub pending: usize,
    pub conversation: usize,
}

fn chars(text: &str) -> usize {
    text.chars().count()
}

/// start から、ends のうち最初に現れる見出しの直前まで
fn between<'a>(text: &'a str, start: &str, ends: &[&str]) -> &'a str {
    let Some(from) = text.find(start) else {
        return "";
    };
    let rest = &text[from..];
    let to = ends.iter().filter_map(|end| rest[1..].find(end).map(|at| at + 1)).min().unwrap_or(rest.len());
    &rest[..to]
}

fn agents(voice: &str) -> Vec<Agent> {
    let mut haru = agent("haru", "worker", "ハル");
    haru.personality = "落ち着いた職人肌".to_owned();
    haru.tone = "一人称は私。丁寧語".to_owned();
    haru.voice = VoiceSettings { mode: voice.to_owned(), intensity: VoiceIntensity::Weak };
    let mut kaname = agent("kaname", "manager", "カナメ");
    kaname.voice = haru.voice.clone();
    vec![kaname, haru, agent("sora", "worker", "ソラ"), agent("logica", "expert", "ロジカ")]
}

fn subtask(id: &str, assignee: &str, status: SubtaskStatus, result: Option<&str>) -> Subtask {
    Subtask {
        id: SubtaskId::new(id),
        assignee_id: AgentId::new(assignee),
        instruction: format!("【{assignee}への指示】{}", "指示の本文。".repeat(200)),
        status,
        result_message_id: result.map(MessageId::new),
        note: None,
    }
}

pub fn delegation(statuses: [SubtaskStatus; 2]) -> Delegation {
    let done = |status: SubtaskStatus, id: &'static str| (status == SubtaskStatus::Done).then_some(id);
    Delegation {
        id: DelegationId::new("d1"),
        channel_id: ChannelId::new("c1"),
        manager_id: AgentId::new("kaname"),
        message_id: MessageId::new("m3"),
        status: DelegationStatus::Running,
        subtasks: vec![
            subtask("s1", "haru", statuses[0], done(statuses[0], "m6")),
            subtask("s2", "sora", statuses[1], done(statuses[1], "m7")),
        ],
        summary_message_id: None,
        created_at: 0,
        updated_at: 0,
    }
}

fn in_root(mut message: Message) -> Message {
    message.root_id = MessageId::new("m1");
    message
}

/// 人間の起点 → マネージャーの割り振り（長い）→ 途中経過 → 担当者2人の結果
pub fn history() -> Vec<Message> {
    let mut assign = in_root(message(3, by("kaname"), &format!("調べた結果をまとめます。{}", "割り振りの本文。".repeat(290))));
    assign.delegation_id = Some(DelegationId::new("d1"));
    let mut progress = in_root(message(4, by("haru"), "調査を始めます"));
    progress.kind = MessageKind::Progress;
    vec![
        message(1, Author::Human, &"圧縮の仕組みを作りたい。".repeat(8)),
        in_root(message(2, by("kaname"), "了解、確認します")),
        assign,
        progress,
        in_root(message(5, by("logica"), "相談の答えです")),
        in_root(message(6, by("haru"), &"ハルの結果。".repeat(300))),
        in_root(message(7, by("sora"), &"ソラの結果。".repeat(300))),
    ]
}

/// 割り振りジョブ（haru）: きっかけはマネージャーの割り振りの発言 m3。履歴は m1〜m3
pub fn task_job(history: &[Message]) -> JobSpec {
    let target = SubtaskRef {
        delegation_id: DelegationId::new("d1"),
        subtask_id: SubtaskId::new("s1"),
        assignee_id: AgentId::new("haru"),
    };
    JobSpec::task(&history[2], target)
}

/// まとめジョブ（kaname）: きっかけは担当者の結果 m6・m7
pub fn report_job(history: &[Message]) -> JobSpec {
    JobSpec {
        agent_id: AgentId::new("kaname"),
        channel_id: ChannelId::new("c1"),
        mode: JobMode::Report,
        triggers: history[5..7].to_vec(),
        return_to: Vec::new(),
        depth: 3,
        root_id: Some(MessageId::new("m1")),
        notes: Vec::new(),
        subtask: None,
        report: Some(DelegationId::new("d1")),
    }
}

/// subject の視点で (システム, 会話) を作る
pub fn build(
    subject: &str,
    voice: &str,
    language: Language,
    history: &[Message],
    job: &JobSpec,
    delegation: Option<&Delegation>,
) -> (String, String) {
    let agents = agents(voice);
    let backends = vec![backend("claude")];
    let lobby = channel("c1", &["me", "kaname", "haru", "sora"]);
    let me = Profile::default();
    let memory = "- 覚えておくこと。".repeat(400);
    let Some(person) = agents.iter().find(|a| a.id.as_str() == subject) else {
        panic!("{subject} がいません");
    };
    let ctx = PromptContext {
        agent: person,
        permissions: effective_permissions(person, None),
        channel: &lobby,
        agents: &agents,
        backends: &backends,
        me: &me,
        skills: &[],
        memory: &memory,
        now_label: "2026年11月27日(金) 14:24",
        time_label: &|ms| format!("t{ms}"),
        attachment_path: &|_, attachment| format!("/guild/attachments/c1/{}", attachment.file_name()),
        delegation,
        language,
    };
    (build_system_prompt(&ctx), build_conversation_prompt(&ctx, history, job, &[]))
}

pub fn measure(system: &str, conversation: &str) -> Sizes {
    let voice = between(system, "## 会話の表現", &["\n## あなたの仕事", "\n## 全エージェント共通の指示"]);
    let history = between(conversation, "# この会話", &["\n# あなた宛ての未対応の発言", "\n# 割り振ったタスクの結果"]);
    let pending = between(
        conversation,
        if conversation.contains("# 割り振ったタスクの結果") {
            "# 割り振ったタスクの結果"
        } else {
            "# あなた宛ての未対応の発言"
        },
        &["\n# "],
    );
    Sizes {
        voice: chars(voice),
        system: chars(system),
        system_utf16: system.encode_utf16().count(),
        history: chars(history),
        pending: chars(pending),
        conversation: chars(conversation),
    }
}

pub fn scenarios() -> Vec<(&'static str, Sizes)> {
    let history = history();
    let task = task_job(&history);
    let report = report_job(&history);
    let running = delegation([SubtaskStatus::Running, SubtaskStatus::Pending]);
    let mut done = delegation([SubtaskStatus::Done, SubtaskStatus::Done]);
    done.status = DelegationStatus::Reporting;
    let rows = [
        ("割り振り ja auto", build("haru", "auto", Language::Ja, &history[..3], &task, Some(&running))),
        ("割り振り en auto", build("haru", "auto", Language::En, &history[..3], &task, Some(&running))),
        ("割り振り ja off", build("haru", "off", Language::Ja, &history[..3], &task, Some(&running))),
        ("まとめ ja auto", build("kaname", "auto", Language::Ja, &history, &report, Some(&done))),
    ];
    rows.into_iter().map(|(name, (system, conversation))| (name, measure(&system, &conversation))).collect()
}

#[test]
fn prompt_size_report() {
    println!("| 場面 | 文体 | システム合計 | システム UTF-16 | 会話履歴 | 未対応/結果 | 会話合計 |");
    println!("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (name, size) in scenarios() {
        println!(
            "| {name} | {} | {} | {} | {} | {} | {} |",
            size.voice, size.system, size.system_utf16, size.history, size.pending, size.conversation
        );
        assert!(size.voice > 0 && size.history > 0 && size.pending > 0, "{name}: 節が見つからない");
    }
}
