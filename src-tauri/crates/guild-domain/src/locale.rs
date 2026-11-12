//! 表示とエージェントの会話の言語（settings.json の `language`。TS の `Language`）と、プロセスの「いまの言語」。
//! 文言は `Language::pick` で日本語・英語・簡体字・繁体字・韓国語の5つから選ぶ（docs/i18n.md）。
//! いまの言語は起動時に settings.json から、`set_language` で変わるたびに設定する。純粋な関数は言語を引数で受け取り、
//! エラーの文面のように呼び出しの経路が長いものだけが `current()` を読む。

use std::sync::atomic::{AtomicU8, Ordering};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
pub enum Language {
    /// 言語の設定がなかった版はすべて日本語だった
    #[default]
    #[serde(rename = "ja")]
    Ja,
    #[serde(rename = "en")]
    En,
    #[serde(rename = "zh-Hans")]
    ZhHans,
    #[serde(rename = "zh-Hant")]
    ZhHant,
    #[serde(rename = "ko")]
    Ko,
}

impl Language {
    pub const ALL: [Language; 5] = [Language::Ja, Language::En, Language::ZhHans, Language::ZhHant, Language::Ko];

    /// settings.json と IPC での値（"ja"・"en"・"zh-Hans"・"zh-Hant"・"ko"）
    pub fn code(self) -> &'static str {
        match self {
            Language::Ja => "ja",
            Language::En => "en",
            Language::ZhHans => "zh-Hans",
            Language::ZhHant => "zh-Hant",
            Language::Ko => "ko",
        }
    }

    /// 知らない値なら None
    pub fn parse(code: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|language| language.code() == code)
    }

    /// 日本語・英語・簡体字・繁体字・韓国語の順に並べた文言から、この言語のものを選ぶ
    pub fn pick<T>(self, texts: [T; 5]) -> T {
        let [ja, en, zh_hans, zh_hant, ko] = texts;
        match self {
            Language::Ja => ja,
            Language::En => en,
            Language::ZhHans => zh_hans,
            Language::ZhHant => zh_hant,
            Language::Ko => ko,
        }
    }

    fn index(self) -> u8 {
        match self {
            Language::Ja => 0,
            Language::En => 1,
            Language::ZhHans => 2,
            Language::ZhHant => 3,
            Language::Ko => 4,
        }
    }
}

static CURRENT: AtomicU8 = AtomicU8::new(0);

/// プロセスのいまの言語（設定する前は日本語）
pub fn current() -> Language {
    let index = CURRENT.load(Ordering::Relaxed);
    Language::ALL.into_iter().find(|language| language.index() == index).unwrap_or_default()
}

/// 起動時と `set_language` のときに呼ぶ
pub fn set_current(language: Language) {
    CURRENT.store(language.index(), Ordering::Relaxed);
}

/// いまの言語で選ぶ（`current().pick(texts)`）
pub fn pick<T>(texts: [T; 5]) -> T {
    current().pick(texts)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_round_trip_and_json_matches_ts() {
        for language in Language::ALL {
            assert_eq!(Language::parse(language.code()), Some(language));
            let json = serde_json::to_string(&language).unwrap();
            assert_eq!(json, format!("\"{}\"", language.code()));
        }
        assert_eq!(Language::parse("zh"), None);
    }

    #[test]
    fn pick_follows_the_order_ja_en_zh_hans_zh_hant_ko() {
        let texts = ["日本語", "English", "简体", "繁體", "한국어"];
        assert_eq!(Language::Ja.pick(texts), "日本語");
        assert_eq!(Language::ZhHant.pick(texts), "繁體");
        assert_eq!(Language::Ko.pick(texts), "한국어");
    }
}
