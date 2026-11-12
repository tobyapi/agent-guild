//! タグの規則（design.md §2）。先頭は役割とサイドバーの区分、残りは分類用。

use super::name::name_key;
use crate::error::ValidationError;
use crate::locale;

/// タグの最大個数
pub const TAG_MAX_COUNT: usize = 8;
/// 1つのタグの最大文字数
pub const TAG_MAX_CHARS: usize = 16;

const FORBIDDEN: [char; 3] = ['#', ',', '@'];

/// 前後の空白を除いて検証し、NFKC＋大文字小文字無視で重複したものは1つにまとめる（順序は保つ）。
/// 各タグは1〜16文字で空白・#・,・@（全角を含む）を含まず、まとめたあとで8個まで。違反は field tags
pub fn normalize_tags(tags: &[String]) -> Result<Vec<String>, ValidationError> {
    let mut result: Vec<String> = Vec::new();
    for tag in tags {
        let tag = tag.trim();
        let length = tag.chars().count();
        if length == 0 {
            return Err(ValidationError::on(
                "tags",
                locale::pick([
                    "空のタグは使えません",
                    "Tags cannot be empty",
                    "标签不能为空",
                    "標籤不能為空",
                    "빈 태그는 사용할 수 없습니다",
                ]),
            ));
        }
        if length > TAG_MAX_CHARS {
            return Err(ValidationError::on(
                "tags",
                locale::pick([
                    "タグは16文字以内にしてください",
                    "Tags can be up to 16 characters",
                    "标签不能超过 16 个字符",
                    "標籤不能超過 16 個字元",
                    "태그는 16자 이내로 입력하십시오",
                ]),
            ));
        }
        let key = name_key(tag);
        let bad_char = |c: char| c.is_whitespace() || c.is_control() || FORBIDDEN.contains(&c);
        if tag.chars().any(bad_char) || key.chars().any(bad_char) {
            return Err(ValidationError::on(
                "tags",
                locale::pick([
                    "タグに空白・#・,・@ は使えません",
                    "Tags cannot contain spaces, #, commas, or @",
                    "标签中不能使用空格、#、逗号或 @",
                    "標籤中不能使用空白、#、逗號或 @",
                    "태그에는 공백, #, 쉼표, @를 사용할 수 없습니다",
                ]),
            ));
        }
        if !result.iter().any(|known| name_key(known) == key) {
            result.push(tag.to_owned());
        }
    }
    if result.len() > TAG_MAX_COUNT {
        return Err(ValidationError::on(
            "tags",
            locale::pick([
                "タグは8個までにしてください",
                "You can add up to 8 tags",
                "标签最多 8 个",
                "標籤最多 8 個",
                "태그는 8개까지 추가할 수 있습니다",
            ]),
        ));
    }
    Ok(result)
}
