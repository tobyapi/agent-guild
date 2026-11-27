use guild_domain::agent::{normalize_agent_input, AgentInput};
use guild_domain::locale::Language;
use guild_domain::profile::Profile;
use guild_domain::prompt::{build_system_prompt, voice_section, PromptContext, VoiceGuide, VOICE_GUIDE};
use guild_domain::voice::{
    appearance_guide, migrate_stored_voice, mode_card, normalize_voice, voice_modes, VoiceIntensity, VoiceSettings,
};
use serde::Deserialize;

use super::support::{agent, channel};

#[derive(Deserialize)]
struct Case {
    input: String,
    expected: Option<String>,
}

#[test]
fn voice_accepts_only_auto_or_off_and_migrates_old_values() {
    let cases: Vec<Case> = serde_json::from_str(include_str!("../../../../../contracts/behavior/voice.json")).unwrap();
    for case in cases {
        let input = VoiceSettings { mode: case.input.clone(), ..Default::default() };
        assert_eq!(normalize_voice(input).ok().map(|voice| voice.mode), case.expected, "{}", case.input);
        if case.expected.is_none() {
            let stored = VoiceSettings { mode: case.input, intensity: VoiceIntensity::Medium };
            assert_eq!(migrate_stored_voice(stored).mode, "auto");
        }
    }
}

#[test]
fn voice_catalog_has_exactly_the_selected_cards_and_their_operations() {
    let modes = voice_modes();
    assert_eq!(modes.len(), 27);
    assert!(modes.windows(2).all(|pair| pair[0].id < pair[1].id));
    for mode in voice_modes() {
        assert_eq!(mode.id.len(), 4);
        assert!(mode.id.chars().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit()));
        assert!(normalize_voice(VoiceSettings { mode: mode.id.clone(), ..Default::default() }).is_err());
        let card = mode_card(&mode);
        assert!(card.contains("## 会話で実行する操作"));
        assert!(card.contains(&mode.title));
    }
}

fn prompt(mode: &str) -> String {
    let mut person = agent("a1", "worker", "ミナ");
    person.personality = "控えめな司書".to_owned();
    person.tone = "一人称は私。丁寧語".to_owned();
    person.voice = VoiceSettings { mode: mode.to_owned(), intensity: VoiceIntensity::Weak };
    let channel = channel("c1", &["me", "a1"]);
    let profile = Profile::default();
    build_system_prompt(&PromptContext {
        agent: &person,
        permissions: Default::default(),
        channel: &channel,
        agents: &[],
        backends: &[],
        me: &profile,
        skills: &[],
        memory: "",
        now_label: "",
        time_label: &|_| String::new(),
        attachment_path: &|_, _| String::new(),
        delegation: None,
        language: Language::Ja,
    })
}

#[test]
fn voice_auto_guidance_reaches_a_model_without_tools_and_preserves_persona() {
    let text = prompt("auto");
    assert!(text.contains("性格: 控えめな司書"));
    assert!(text.contains("口調: 一人称は私。丁寧語"));
    assert!(text.contains("普段の口調のまま答えてよい"));
    assert!(text.contains("今回の返答だけ"));
    for mode in voice_modes() {
        assert!(text.contains(&format!("- {}", mode.title)));
        assert!(!text.contains(&mode.id));
    }
    assert!(!text.contains("手動固定"));
}

#[test]
fn voice_off_uses_persona_without_style_cards() {
    let off = prompt("off");
    assert!(off.contains("基本の性格・口調で応答してください"));
    assert!(!off.contains("### 文体の候補と操作"));
}

fn person(mode: &str) -> guild_domain::agent::Agent {
    let mut person = agent("a1", "worker", "ミナ");
    person.voice = VoiceSettings { mode: mode.to_owned(), intensity: VoiceIntensity::Medium };
    person
}

/// 毎回送るのは短いガイド。表示構文の要点と禁止事項は残し、全文のカードは送らない
#[test]
fn voice_auto_sends_the_compact_guide_with_the_display_syntax() {
    assert_eq!(VOICE_GUIDE, VoiceGuide::Compact);
    let text = prompt("auto");
    assert!(text.contains("表示先: agent-guild のチャット"));
    for syntax in [
        ":t[",
        ":chars[",
        ":path[",
        ":::layout{rotate=0}",
        ":::layout{vertical}",
        "
- 禁止: ",
    ] {
        assert!(text.contains(syntax), "{syntax}");
    }
    assert!(text.contains("コードフェンスやバッククォートで囲む") && text.contains("メンションを入れる"));
    assert!(text.contains("ユーザーの台詞・行動・内心を代筆しない"));
    assert!(text.contains("作業の報告・調査結果・レビューや判定"));
    assert!(!text.contains(&appearance_guide()) && !text.contains("表示の使い分け:"));
    for heading in ["## メンションのルール", "## スキル使用の申告", "## 出力のルール"] {
        assert!(text.contains(heading), "{heading}");
    }
}

/// 候補の一覧は同梱スキルのカタログと1対1（カタログが変わったら一覧も直す）
#[test]
fn voice_compact_guide_lists_each_catalog_mode_once_in_one_line() {
    let section = voice_section(&person("auto"), VoiceGuide::Compact);
    let list = section
        .split(
            "### 文体の候補
",
        )
        .nth(1)
        .unwrap()
        .split(
            "

",
        )
        .next()
        .unwrap();
    let lines: Vec<&str> = list.lines().collect();
    assert_eq!(lines.len(), voice_modes().len());
    for mode in voice_modes() {
        let prefix = format!("- {}: ", mode.title);
        assert_eq!(lines.iter().filter(|line| line.starts_with(&prefix)).count(), 1, "{}", mode.title);
    }
    assert!(section.contains("保存された強度: 中"));
}

#[test]
fn voice_compact_section_stays_within_3000_chars_and_off_is_unchanged() {
    for intensity in [VoiceIntensity::Weak, VoiceIntensity::Medium, VoiceIntensity::Strong] {
        let mut subject = person("auto");
        subject.voice.intensity = intensity;
        let chars = voice_section(&subject, VoiceGuide::Compact).chars().count();
        assert!(chars <= 3000, "{chars}");
    }
    let off = "## 会話の表現
保存設定は「いつもの口調」です。基本の性格・口調で応答してください。
";
    assert_eq!(voice_section(&person("off"), VoiceGuide::Compact), off);
    assert_eq!(voice_section(&person("off"), VoiceGuide::Full), off);
}

/// 全文に戻したときは、以前と同じく選び方・見た目の判断・全候補の操作と表示を送る
#[test]
fn voice_full_guide_still_reaches_every_mode_without_skill_assignment() {
    let guide = appearance_guide();
    assert!(!guide.is_empty());
    let text = voice_section(&person("auto"), VoiceGuide::Full);
    assert!(text.contains("表示先: agent-guild のチャット"));
    assert!(text.contains(&guide));
    assert!(text.contains("普段の口調のまま答えてよい"));
    for mode in voice_modes() {
        let card = mode_card(&mode);
        let visual = card
            .split("## 見た目の使い分け")
            .nth(1)
            .unwrap()
            .split(
                "
## ",
            )
            .next()
            .unwrap()
            .trim();
        assert!(!visual.is_empty());
        assert!(text.contains(visual), "{}", mode.id);
        assert!(text.contains(&format!("- {}（別名: ", mode.title)));
    }
    assert!(text.chars().count() > 10_000);
    assert!(!prompt("off").contains(&guide));
}

#[test]
fn voice_old_agent_input_defaults_to_auto_and_invalid_selection_cannot_be_saved() {
    let mut value: serde_json::Value =
        serde_json::from_str(include_str!("../../../../../contracts/ipc/agent-input.json")).unwrap();
    value.as_object_mut().unwrap().remove("voice");
    let mut input: AgentInput = serde_json::from_value(value).unwrap();
    assert_eq!(input.voice, VoiceSettings::default());
    input.voice.mode = "061".to_owned();
    assert_eq!(normalize_agent_input(input, None).unwrap_err().field(), Some("voice"));
}
