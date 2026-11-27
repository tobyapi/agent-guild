//! auto で毎回送る短い文体ガイド（voice_compact.md）のテスト。
//! 既定値（VOICE_GUIDE）に依らず voice_section(…, VoiceGuide::Compact) を直接呼ぶ。
//! VOICE_GUIDE を Full に戻したときに落ちるのは voice_default_guide_is_compact だけにする。

use guild_domain::prompt::{voice_section, VoiceGuide, VOICE_GUIDE};
use guild_domain::voice::{appearance_guide, mode_card, selection_guide, voice_modes, VoiceIntensity};

use super::voice::person;

/// 既定値を固定するのはここだけ。全文に戻すときは、この期待値を Full に書き換える
#[test]
fn voice_default_guide_is_compact() {
    assert_eq!(VOICE_GUIDE, VoiceGuide::Compact);
}

fn compact() -> String {
    voice_section(&person("auto"), VoiceGuide::Compact)
}

/// 表示構文の要点と禁止事項は残し、全文のカードは送らない
#[test]
fn voice_compact_guide_keeps_the_display_syntax_and_safety_rules() {
    let text = compact();
    assert!(text.contains("表示先: agent-guild のチャット"));
    for syntax in [":t[", ":chars[", ":path[", ":::layout{rotate=0}", ":::layout{vertical}", "\n- 禁止: "] {
        assert!(text.contains(syntax), "{syntax}");
    }
    assert!(text.contains("コードフェンスやバッククォートで囲む") && text.contains("メンションを入れる"));
    assert!(text.contains("ユーザーの台詞・行動・内心を代筆しない"));
    assert!(text.contains("作業の報告・調査結果・レビューや判定"));
    assert!(text.contains("普段の一言や情報交換には使わない"), ":path と縦書きの使う場面");
    assert!(text.contains("黒・白に固定しない"));
    assert!(text.contains("普段の口調のまま答えてよい") && text.contains("今回の返答だけ"));
    assert!(!text.contains(&appearance_guide()) && !text.contains("表示の使い分け:"));
}

/// 候補の一覧は同梱スキルのカタログと1対1（カタログが変わったら一覧も直す）
#[test]
fn voice_compact_guide_lists_each_catalog_mode_once_in_one_line() {
    let section = compact();
    let list = section.split("### 文体の候補\n").nth(1).unwrap().split("\n\n").next().unwrap();
    let lines: Vec<&str> = list.lines().collect();
    assert_eq!(lines.len(), voice_modes().len());
    for mode in voice_modes() {
        let prefix = format!("- {}: ", mode.title);
        assert_eq!(lines.iter().filter(|line| line.starts_with(&prefix)).count(), 1, "{}", mode.title);
        assert!(!section.contains(&mode.id));
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
    let off = "## 会話の表現\n保存設定は「いつもの口調」です。基本の性格・口調で応答してください。\n";
    assert_eq!(voice_section(&person("off"), VoiceGuide::Compact), off);
    assert_eq!(voice_section(&person("off"), VoiceGuide::Full), off);
}

/// 64 ビット FNV-1a。Rust の版で変わらない値にするため自前で計算する
fn fnv1a(text: &str) -> u64 {
    text.bytes().fold(0xcbf2_9ce4_8422_2325, |hash, byte| (hash ^ u64::from(byte)).wrapping_mul(0x0100_0000_01b3))
}

/// 全文ガイドの元（選び方・見た目の判断・全候補のカード）。改行コードの違いは無視する
fn full_sources() -> String {
    let mut text = selection_guide() + "\n" + &appearance_guide();
    for mode in voice_modes() {
        text.push('\n');
        text.push_str(&mode_card(&mode));
    }
    text.replace('\r', "")
}

/// 短いガイドは全文ガイドを手で要約したもの。元が変わったら、短いガイドも見直してから値を更新する
#[test]
fn voice_full_guide_sources_are_unchanged_since_the_compact_guide_was_written() {
    let sources = full_sources();
    let actual = (sources.chars().count(), fnv1a(&sources));
    assert_eq!(
        actual,
        (20_677, 906_448_322_352_209_349),
        "全文ガイドが変わった。voice_compact.md も見直してから、この値を {actual:?} に更新する"
    );
}
