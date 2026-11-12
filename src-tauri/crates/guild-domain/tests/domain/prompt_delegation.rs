//! 割り振りのプロンプト（§8）: マネージャーの「割り振りのしかた」・メンバー一覧の実効権限の要約・task と report の指示。

use guild_domain::agent::{effective_permissions, Agent};
use guild_domain::backend::BackendInfo;
use guild_domain::conversation::{JobMode, JobSpec};
use guild_domain::delegation::{Delegation, DelegationStatus, Subtask, SubtaskNote, SubtaskRef, SubtaskStatus};
use guild_domain::ids::{AgentId, ChannelId, DelegationId, MessageId, SubtaskId};
use guild_domain::locale::Language;
use guild_domain::message::Message;
use guild_domain::profile::Profile;
use guild_domain::prompt::{build_conversation_prompt, build_system_prompt, PromptContext};

use super::support::{agent, backend, by, channel, message};

fn agents() -> Vec<Agent> {
    let mut sora = agent("sora", "worker", "ソラ");
    sora.backend = "codex".to_owned();
    vec![
        agent("kaname", "manager", "カナメ"),
        agent("haru", "worker", "ハル"),
        sora,
        agent("logica", "expert", "ロジカ"),
    ]
}

fn backends() -> Vec<BackendInfo> {
    let mut codex = backend("codex");
    codex.capabilities.web_search = false;
    vec![backend("claude"), codex]
}

fn delegation(statuses: [SubtaskStatus; 2]) -> Delegation {
    let subtask = |id: &str, assignee: &str, status: SubtaskStatus| Subtask {
        id: SubtaskId::new(id),
        assignee_id: AgentId::new(assignee),
        instruction: format!("{assignee}への指示\n2行目"),
        status,
        result_message_id: (status == SubtaskStatus::Done).then(|| MessageId::new(format!("r-{assignee}"))),
        note: (status == SubtaskStatus::Failed).then(|| SubtaskNote::NoAnswer.text(Language::Ja).to_owned()),
    };
    Delegation {
        id: DelegationId::new("d1"),
        channel_id: ChannelId::new("c1"),
        manager_id: AgentId::new("kaname"),
        message_id: MessageId::new("m1"),
        status: DelegationStatus::Running,
        subtasks: vec![subtask("s1", "haru", statuses[0]), subtask("s2", "sora", statuses[1])],
        summary_message_id: None,
        created_at: 0,
        updated_at: 0,
    }
}

/// subject の視点のプロンプト（システム, 会話）
fn prompts(subject: &str, job: &JobSpec, delegation: Option<&Delegation>) -> (String, String) {
    let (agents, backends) = (agents(), backends());
    let lobby = channel("c1", &["me", "kaname", "haru", "sora"]);
    let me = Profile::default();
    let Some(subject) = agents.iter().find(|a| a.id.as_str() == subject) else {
        panic!("{subject} がいません");
    };
    let ctx = PromptContext {
        agent: subject,
        permissions: effective_permissions(subject, None),
        channel: &lobby,
        agents: &agents,
        backends: &backends,
        me: &me,
        skills: &[],
        memory: "",
        now_label: "",
        time_label: &|ms| format!("t{ms}"),
        attachment_path: &|_, attachment| format!("/guild/attachments/c1/{}", attachment.file_name()),
        delegation,
        language: Language::Ja,
    };
    (build_system_prompt(&ctx), build_conversation_prompt(&ctx, &[], job, &[]))
}

fn target(subtask: &str, assignee: &str) -> SubtaskRef {
    SubtaskRef {
        delegation_id: DelegationId::new("d1"),
        subtask_id: SubtaskId::new(subtask),
        assignee_id: AgentId::new(assignee),
    }
}

#[test]
fn managers_learn_how_to_delegate_and_see_what_members_can_do() {
    let job = JobSpec::respond(AgentId::new("kaname"), &message(1, by("haru"), "依頼"), JobMode::Reply, Vec::new());
    let (system, _) = prompts("kaname", &job, None);
    assert!(system.contains("## 割り振りのしかた") && system.contains("```tasks\n@名前: 指示"));
    assert!(system.contains("- @ソラ（タグ: 作業者／担当: ソラの役割／得意分野: ソラの専門／できること: Web 閲覧・ファイル作成（PC 全体）・コマンド実行・スキル）"), "実効権限で要約する");
    assert!(system.contains("チャンネルにいないエージェント（割り振ると自動で参加します）:\n- @ロジカ（"));
    assert!(system.contains("分担が必要かを判断") && system.contains("一連の仕事は1人に任せ"));
    assert!(system.contains("完成条件と根拠を確認してから"));
    let (worker, _) = prompts("haru", &job, None);
    assert!(!worker.contains("## 割り振りのしかた"), "canDelegate でなければ出さない");
}

#[test]
fn a_task_job_quotes_the_instruction_from_the_manager() {
    let delegation = delegation([SubtaskStatus::Running, SubtaskStatus::Pending]);
    let job = JobSpec::task(&message(1, by("kaname"), "割り振ります"), target("s1", "haru"));
    let (_, prompt) = prompts("haru", &job, Some(&delegation));
    assert!(prompt.contains("# あなた宛ての未対応の発言\n[t0] カナメ:\n割り振ります"));
    assert!(prompt.contains(
        "# あなたの番です（割り振られたタスク）\nカナメ から割り振られたタスクです:\n> haruへの指示\n> 2行目"
    ));
    assert!(prompt.contains("ファイル名と場所") && prompt.contains("その旨と理由"));

    let back = JobSpec {
        subtask: Some(target("s1", "haru")),
        ..JobSpec::respond(AgentId::new("haru"), &message(2, by("logica"), "OK"), JobMode::Return, Vec::new())
    };
    let (_, returned) = prompts("haru", &back, Some(&delegation));
    assert!(
        returned.contains("# 相談の結果が届きました")
            && returned.contains("カナメ から割り振られた次のタスクの続きです")
    );
}

#[test]
fn a_report_job_lists_each_result_or_reason() {
    let mut delegation = delegation([SubtaskStatus::Done, SubtaskStatus::Failed]);
    delegation.status = DelegationStatus::Reporting;
    let result = Message { id: MessageId::new("r-haru"), ..message(5, by("haru"), "調べた結果です") };
    let job = JobSpec {
        agent_id: AgentId::new("kaname"),
        channel_id: ChannelId::new("c1"),
        mode: JobMode::Report,
        triggers: vec![result],
        return_to: Vec::new(),
        depth: 3,
        root_id: Some(MessageId::new("m0")),
        notes: Vec::new(),
        subtask: None,
        report: Some(DelegationId::new("d1")),
    };
    let (_, prompt) = prompts("kaname", &job, Some(&delegation));
    assert!(!prompt.contains("# あなた宛ての未対応の発言"), "結果は割り振りごとに並べる");
    assert!(prompt.contains("# 割り振ったタスクの結果がそろいました\n## 1. @ハル（完了）\n指示:\n> haruへの指示\n> 2行目\n結果:\n調べた結果です"));
    assert!(prompt.contains("## 2. @ソラ（失敗）\n指示:\n> soraへの指示\n> 2行目\n理由: 回答がありませんでした"));
    assert!(prompt.contains("# あなたの番です（まとめ）") && prompt.contains("tasks ブロックで追加の割り振り"));
}
