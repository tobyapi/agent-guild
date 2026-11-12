//! 枠の SVG に残してよい要素と属性（表は allowlist.rs）と、参照・値の検査。

use super::allowlist::{ATTRIBUTES, ELEMENTS, FORBIDDEN, SHAPES};

pub(super) fn is_allowed_element(name: &str) -> bool {
    ELEMENTS.contains(&name)
}

pub(super) fn is_shape(name: &str) -> bool {
    SHAPES.contains(&name)
}

pub(super) fn is_forbidden_element(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    let local = lower.rsplit(':').next().unwrap_or(&lower);
    FORBIDDEN.contains(&local)
}

pub(super) fn is_allowed_attribute(name: &str) -> bool {
    ATTRIBUTES.contains(&name)
}

/// イベント属性（onload など）
pub(super) fn is_event_attribute(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.rsplit(':').next().unwrap_or(&lower).starts_with("on")
}

/// href・xlink:href など、参照を持つ属性
pub(super) fn is_reference_attribute(name: &str) -> bool {
    name.eq_ignore_ascii_case("href") || name.to_ascii_lowercase().ends_with(":href")
}

/// 同じ文書の中の #id だけ
pub(super) fn is_local_reference(value: &str) -> bool {
    value.strip_prefix('#').is_some_and(|id| {
        !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | ':'))
    })
}

/// 値の中の url(...) がすべて url(#id) で、スクリプトの URL を含まないか
pub(super) fn is_safe_value(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    if lower.contains("javascript:") || lower.contains("expression(") || lower.contains('\\') {
        return false;
    }
    let mut rest = lower.as_str();
    while let Some(at) = rest.find("url(") {
        let inner = &rest[at + 4..];
        let Some(end) = inner.find(')') else {
            return false;
        };
        let target = inner[..end].trim().trim_matches(|c| c == '"' || c == '\'');
        if !is_local_reference(target) {
            return false;
        }
        rest = &inner[end + 1..];
    }
    true
}
