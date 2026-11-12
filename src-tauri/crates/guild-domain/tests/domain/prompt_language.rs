//! 会話の言語（§8）: 日本語以外ではシステムプロンプトの先頭にその言語で書く節、会話プロンプトの最後に念押しが入る。
//! 日本語では何も入らない（言語の設定がなかった版と同じプロンプト）。

use guild_domain::agent::{effective_permissions, Agent};
use guild_domain::author::Author;
use guild_domain::conversation::{JobMode, JobSpec};
use guild_domain::ids::AgentId;
use guild_domain::locale::Language;
use guild_domain::profile::Profile;
use guild_domain::prompt::{build_conversation_prompt, build_system_prompt, PromptContext};

use super::support::{agent, channel, message};

/// (システムプロンプト, 会話プロンプト)
fn prompts(language: Language) -> (String, String) {
    let agents: Vec<Agent> = vec![agent("haru", "worker", "ハル")];
    let lobby = channel("c1", &["me", "haru"]);
    let me = Profile::default();
    let ctx = PromptContext {
        agent: &agents[0],
        permissions: effective_permissions(&agents[0], None),
        channel: &lobby,
        agents: &agents,
        backends: &[],
        me: &me,
        skills: &[],
        memory: "",
        now_label: "",
        time_label: &|ms| format!("t{ms}"),
        attachment_path: &|_, attachment| attachment.file_name(),
        delegation: None,
        language,
    };
    let human = message(1, Author::Human, "調べて");
    let job = JobSpec::respond(AgentId::new("haru"), &human, JobMode::Reply, Vec::new());
    (build_system_prompt(&ctx), build_conversation_prompt(&ctx, std::slice::from_ref(&human), &job, &[]))
}

#[test]
fn japanese_adds_no_language_instruction() {
    let (system, conversation) = prompts(Language::Ja);
    assert!(system.starts_with("あなたは「ハル」です。"), "{system}");
    assert!(!system.contains("# Language"));
    assert!(!conversation.contains("English"));
}

#[test]
fn english_asks_to_write_in_english_at_the_top_and_at_the_end() {
    let (system, conversation) = prompts(Language::En);
    assert!(system.starts_with("# Language\nAlways write in English:"), "{system}");
    for part in ["progress updates", "tasks blocks", "consulted", "MEMORY.md", "written in Japanese", "@mentions"] {
        assert!(system.contains(part), "{part}");
    }
    assert!(system.contains("\nあなたは「ハル」です。"), "本文は日本語のまま");
    let reminder = "(Write in English. Keep code, identifiers, file names, @mentions, names, and [PASS] as they are.)";
    assert!(conversation.ends_with(&format!("\n\n{reminder}")), "{conversation}");
    let (japanese_system, japanese_conversation) = prompts(Language::Ja);
    assert!(system.ends_with(&japanese_system), "ほかの節は変わらない");
    assert!(conversation.starts_with(&japanese_conversation), "念押しの前は変わらない");
}

#[test]
fn every_other_language_has_its_own_instruction() {
    let (japanese_system, _) = prompts(Language::Ja);
    for language in [Language::ZhHans, Language::ZhHant, Language::Ko] {
        let (system, conversation) = prompts(language);
        assert!(system.len() > japanese_system.len() && system.ends_with(&japanese_system), "{language:?}");
        assert!(!system.contains("English") && !conversation.contains("English"), "{language:?}");
        assert!(conversation.ends_with('）') || conversation.ends_with(')'), "{language:?}");
    }
}
