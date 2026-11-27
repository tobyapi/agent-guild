//! 指示文の大きさの計測: 同じ固定入力から、節ごとの文字数（Unicode の文字数と UTF-16 単位）を出す。
//! `cargo test -p guild-domain --test domain prompt_size -- --nocapture` で表を表示する。

use guild_domain::delegation::{DelegationStatus, SubtaskStatus};
use guild_domain::locale::Language;
use guild_domain::prompt::{voice_section, VoiceGuide, VOICE_GUIDE};

use super::prompt_fixture::{build, delegation, history, member, report_job, task_job};

pub struct Sizes {
    pub voice: usize,
    pub system: usize,
    pub system_utf16: usize,
    pub history: usize,
    pub pending: usize,
    pub conversation: usize,
    /// 文体の節を短いガイドにしたときの文体の文字数と、システム側の UTF-16 単位（既定の VOICE_GUIDE に依らない）
    pub compact_voice: usize,
    pub compact_system_utf16: usize,
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

fn utf16(text: &str) -> usize {
    text.encode_utf16().count()
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
        compact_voice: 0,
        compact_system_utf16: 0,
    }
}

/// 既定のガイドの節を短いガイドの節に差し替えた大きさを足す
fn with_compact(mut size: Sizes, subject: &str, voice: &str) -> Sizes {
    let person = member(subject, voice);
    let compact = voice_section(&person, VoiceGuide::Compact);
    size.compact_voice = chars(&compact);
    size.compact_system_utf16 = size.system_utf16 - utf16(&voice_section(&person, VOICE_GUIDE)) + utf16(&compact);
    size
}

pub fn scenarios() -> Vec<(&'static str, Sizes)> {
    let history = history();
    let task = task_job(&history);
    let report = report_job(&history);
    let running = delegation([SubtaskStatus::Running, SubtaskStatus::Pending]);
    let mut done = delegation([SubtaskStatus::Done, SubtaskStatus::Done]);
    done.status = DelegationStatus::Reporting;
    let rows = [
        ("割り振り ja auto", "haru", "auto", Language::Ja, &history[..3], &task, Some(&running)),
        ("割り振り en auto", "haru", "auto", Language::En, &history[..3], &task, Some(&running)),
        ("割り振り ja off", "haru", "off", Language::Ja, &history[..3], &task, Some(&running)),
        ("まとめ ja auto", "kaname", "auto", Language::Ja, &history[..], &report, Some(&done)),
    ];
    rows.into_iter()
        .map(|(name, subject, voice, language, past, job, delegation)| {
            let (system, conversation) = build(subject, voice, language, past, job, delegation);
            (name, with_compact(measure(&system, &conversation), subject, voice))
        })
        .collect()
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

/// Codex のランナーが実行前に拒否する systemPrompt の長さ（UTF-16 単位。agent-runner/src/backends/codex-runtime/options.ts）
const CODEX_SYSTEM_PROMPT_LIMIT: usize = 24_000;

/// 短いガイドなら、文体の節は3,000文字以内。メモ4,000文字を入れても、システム側は Codex の上限の半分ほどに収まる。
/// 既定の VOICE_GUIDE を全文に戻しても、上限そのものは超えない
#[test]
fn prompt_size_voice_section_and_system_prompt_stay_small() {
    for (name, size) in scenarios() {
        assert!(size.compact_voice <= 3000, "{name}: 文体 {}", size.compact_voice);
        assert!(size.compact_system_utf16 <= CODEX_SYSTEM_PROMPT_LIMIT / 2, "{name}: {}", size.compact_system_utf16);
        assert!(size.system_utf16 <= CODEX_SYSTEM_PROMPT_LIMIT, "{name}: システム {}", size.system_utf16);
    }
}
