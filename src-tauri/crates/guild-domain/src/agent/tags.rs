//! タグの規則（design.md §2）。タグは表示と絞り込みだけに使い、振る舞いには影響しない。

use super::name::name_key;
use crate::error::ValidationError;

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
            return Err(ValidationError::on("tags", "空のタグは使えません"));
        }
        if length > TAG_MAX_CHARS {
            return Err(ValidationError::on("tags", "タグは16文字以内にしてください"));
        }
        let key = name_key(tag);
        let bad_char = |c: char| c.is_whitespace() || c.is_control() || FORBIDDEN.contains(&c);
        if tag.chars().any(bad_char) || key.chars().any(bad_char) {
            return Err(ValidationError::on("tags", "タグに空白・#・,・@ は使えません"));
        }
        if !result.iter().any(|known| name_key(known) == key) {
            result.push(tag.to_owned());
        }
    }
    if result.len() > TAG_MAX_COUNT {
        return Err(ValidationError::on("tags", "タグは8個までにしてください"));
    }
    Ok(result)
}
