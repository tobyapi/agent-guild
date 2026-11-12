//! システムプロンプト: 種別ポリシーと実効権限による出し分け。

use guild_domain::agent::{effective_permissions, Agent, Permissions};
use guild_domain::backend::BackendInfo;
use guild_domain::ids::{AgentId, SkillId};
use guild_domain::locale::Language;
use guild_domain::profile::Profile;
use guild_domain::prompt::{build_system_prompt, PromptContext};
use guild_domain::skill::Skill;

use super::support::{agent, backend, channel};

fn agents() -> Vec<Agent> {
    let mut ghost = agent("ghost", "expert", "ゴースト");
    ghost.deleted_at = Some(1);
    let haru = agent("haru", "worker", "ハル");
    let mut sora = agent("sora", "worker", "ソラ");
    sora.tags.push("実装".to_owned());
    let logica = agent("logica", "expert", "ロジカ");
    let mut reader = agent("reader", "expert", "参照係");
    reader.tags.clear();
    vec![haru, sora, logica, agent("gear", "expert", "ギア"), ghost, reader]
}

fn skill(name: &str) -> Skill {
    Skill {
        id: SkillId::new(name),
        agent_id: AgentId::new("logica"),
        name: name.to_owned(),
        description: format!("{name} の説明"),
        body: String::new(),
        source: None,
        problem: None,
        updated_at: 0,
    }
}

fn system_prompt(agent_id: &str, skills: &[Skill], memory: &str) -> String {
    system_prompt_with_backends(agent_id, skills, memory, &[])
}

fn system_prompt_with_backends(agent_id: &str, skills: &[Skill], memory: &str, backends: &[BackendInfo]) -> String {
    let agents = agents();
    let lobby = channel("c1", &["me", "haru", "sora", "logica", "ghost"]);
    let me = Profile::default();
    let Some(subject) = agents.iter().find(|a| a.id.as_str() == agent_id) else {
        panic!("{agent_id} がいません");
    };
    let ctx = PromptContext {
        agent: subject,
        permissions: effective_permissions(subject, backends.first()),
        channel: &lobby,
        agents: &agents,
        backends,
        me: &me,
        skills,
        memory,
        now_label: "2026年11月8日(日) 15:30",
        time_label: &|_| String::new(),
        attachment_path: &|_, attachment| format!("/guild/attachments/c1/{}", attachment.file_name()),
        delegation: None,
        language: Language::Ja,
    };
    build_system_prompt(&ctx)
}

#[test]
fn worker_prompt_describes_writing_and_memory() {
    let prompt = system_prompt("haru", &[], "人間はコーヒー派");
    assert!(prompt.starts_with("あなたは「ハル」です。"));
    assert!(prompt.contains("- タグ: 作業者\n"));
    assert!(prompt.contains("## あなたの仕事"));
    assert!(!prompt.contains("## 相談・レビューへの答え方"), "consultable でなければ答え方の節はない");
    assert!(prompt.contains("作業場所の外も含めたファイルの読み書き"));
    assert!(prompt.contains("コマンドの実行"));
    assert!(prompt.contains("MEMORY.md に追記してください"));
    assert!(prompt.contains("### MEMORY.md の現在の内容（末尾）\n人間はコーヒー派"));
}

#[test]
fn permissions_and_tags_appear_in_the_prompt() {
    let prompt = system_prompt("sora", &[], "");
    assert!(prompt.contains("コマンドの実行"));
    assert!(prompt.contains("- タグ: 作業者・実装\n"));
    assert!(prompt.contains("作業場所の外も含めたファイルの読み書き"));
    assert!(prompt.contains("外のファイルは頼まれた範囲だけを変え"));
}

#[test]
fn memory_is_cut_to_its_last_4000_chars() {
    let memory = format!("{}{}", "古".repeat(10), "新".repeat(4000));
    let prompt = system_prompt("haru", &[], &memory);
    assert!(!prompt.contains('古'));
    assert!(prompt.contains(&"新".repeat(4000)));
}

#[test]
fn a_conversation_backend_can_reference_memory_without_writing_it() {
    let conversation_only = BackendInfo { capabilities: Permissions::default(), ..backend("claude") };
    let prompt = system_prompt_with_backends("haru", &[], "前回のメモ", &[conversation_only]);
    assert!(prompt.contains("### MEMORY.md の現在の内容（末尾）\n前回のメモ"));
    assert!(!prompt.contains("MEMORY.md に追記してください"));
    assert!(!prompt.contains("読み書きしてかまいません"));
}

#[test]
fn everyone_sees_the_active_consultants_and_the_return_flow() {
    let prompt = system_prompt("haru", &[], "");
    assert!(prompt.contains("## 相談のしかた"));
    assert!(prompt.contains("- @ロジカ: ロジカの専門"));
    assert!(prompt.contains("- @ギア: ギアの専門"), "チャンネル外の相談相手も出す");
    assert!(!prompt.contains("@ゴースト"), "削除済みは出さない");
    assert!(prompt.contains("回答がなかった・失敗したときも、その注記つきで番が回ってきます"));
}

#[test]
fn a_consultable_reader_answers_consultations_and_keeps_memory_md_only() {
    let prompt = system_prompt("reader", &[], "前回のメモ");
    assert!(prompt.contains("## 相談・レビューへの答え方"));
    assert!(prompt.contains("- 得意分野: 参照係の専門"));
    assert!(prompt.contains("ファイルの読み取り"));
    assert!(prompt.contains("ファイルの作成・編集はできません"));
    assert!(prompt.contains("作業場所の MEMORY.md だけは例外として、いつでも読み書きしてかまいません"));
    assert!(
        prompt.contains("MEMORY.md 以外のファイルは、「できること」にあるとおりにしてください"),
        "ほかは設定に従う"
    );
    assert!(prompt.contains("### MEMORY.md の現在の内容（末尾）\n前回のメモ"), "書けなくても前回のメモは届く");
    assert!(!prompt.contains("自由にファイルを置けます"), "作業場所に自由に置けるのは書き込める人だけ");
    assert!(prompt.contains("- @ギア: ギアの専門") && !prompt.contains("- @参照係: "), "自分以外の相談相手だけ");
    assert!(prompt.contains("✅ 問題なし / ⚠️ 要修正 / ❌ 作り直し推奨"));
}

#[test]
fn lists_skills_by_name_and_description() {
    let prompt = system_prompt("logica", &[skill("review-checklist")], "");
    assert!(prompt.contains("## あなたのスキル（専門知識の手引き）\n- review-checklist: review-checklist の説明"));
    assert!(!system_prompt("logica", &[], "").contains("## あなたのスキル"));
}

#[test]
fn shows_place_members_and_rules() {
    let prompt = system_prompt("haru", &[], "");
    assert!(prompt.contains("チャンネル #ロビー にいます。\nチャンネルの話題: 雑談"));
    assert!(prompt.contains("現在日時: 2026年11月8日(日) 15:30"));
    assert!(prompt.contains("- ユーザー（人間・このアプリの使用者）"));
    assert!(prompt.contains("- @ソラ（タグ: 作業者・実装／担当: ソラの役割／得意分野: ソラの専門／できること: Web 検索・Web 閲覧・ファイル作成（PC 全体）・コマンド実行・スキル）"));
    assert!(prompt.contains("- @ロジカ（タグ: 専門家／担当: ロジカの役割／得意分野: ロジカの専門／できること: ファイル作成・ファイル読み取り（PC 全体）・コマンド実行・スキル）"));
    assert!(!prompt.contains("- @ハル（"), "自分自身はメンバー一覧に出さない");
    assert!(!prompt.contains("- @ゴースト（"), "削除済みはメンバー一覧に出さない");
    assert!(prompt.contains("名前の接頭辞（「ハル:」など）はつけないでください"));
    assert!(prompt.contains("[PASS] とだけ出力してください"));
}
