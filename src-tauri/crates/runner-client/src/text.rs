//! 利用者に見える文面（ランナーの状態の理由など）の言語。言語はアプリが渡すコード（"ja"・"en"・"zh-Hans"・"zh-Hant"・"ko"）。
//! このクレートはアプリのドメインに依存しないので、並び（日本語・英語・簡体字・繁体字・韓国語）だけを合わせる。

/// 日本語・英語・簡体字・繁体字・韓国語の順に並べた文言から、code の言語のものを選ぶ（知らないコードは日本語）
pub(crate) fn pick<T>(code: &str, texts: [T; 5]) -> T {
    let [ja, en, zh_hans, zh_hant, ko] = texts;
    match code {
        "en" => en,
        "zh-Hans" => zh_hans,
        "zh-Hant" => zh_hant,
        "ko" => ko,
        _ => ja,
    }
}

#[cfg(test)]
mod tests {
    use super::pick;

    #[test]
    fn picks_by_code_and_falls_back_to_japanese() {
        let texts = ["日本語", "English", "简体", "繁體", "한국어"];
        assert_eq!(pick("en", texts), "English");
        assert_eq!(pick("zh-Hant", texts), "繁體");
        assert_eq!(pick("ko", texts), "한국어");
        assert_eq!(pick("", texts), "日本語");
        assert_eq!(pick("fr", texts), "日本語");
    }
}
