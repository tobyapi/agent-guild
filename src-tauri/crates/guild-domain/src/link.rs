//! アプリの外（OS の既定のブラウザ）で開くリンクの検証。開いてよいのは http と https だけ。

use crate::error::{ensure_max_chars, ValidationError};

/// URL の最大文字数
pub const URL_MAX_CHARS: usize = 2048;

/// 開いてよいリンクなら前後の空白を除いて返す: http:// か https:// で始まり、ホストがあり、空白や制御文字を含まない
pub fn external_url(url: &str) -> Result<String, ValidationError> {
    let url = url.trim();
    let rest = ["http://", "https://"]
        .iter()
        .find(|scheme| url.len() >= scheme.len() && url[..scheme.len()].eq_ignore_ascii_case(scheme))
        .map(|scheme| &url[scheme.len()..]);
    let has_host = rest.is_some_and(|rest| !rest.is_empty() && !rest.starts_with('/'));
    if !has_host {
        return Err(ValidationError::on("url", "開けるのは http と https のリンクだけです"));
    }
    if url.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err(ValidationError::on("url", "リンクに空白や制御文字が含まれています"));
    }
    ensure_max_chars(url, URL_MAX_CHARS, "url", "リンクが長すぎます")?;
    Ok(url.to_owned())
}
