//! アプリの外（OS の既定のブラウザ）で開くリンクの検証。開いてよいのは http と https だけ。

use crate::error::{ensure_max_chars, ValidationError};
use crate::locale;

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
        return Err(ValidationError::on(
            "url",
            locale::pick([
                "開けるのは http と https のリンクだけです",
                "Only http and https links can be opened",
                "只能打开 http 和 https 链接",
                "只能開啟 http 和 https 連結",
                "http 및 https 링크만 열 수 있습니다",
            ]),
        ));
    }
    if url.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err(ValidationError::on(
            "url",
            locale::pick([
                "リンクに空白や制御文字が含まれています",
                "The link contains spaces or control characters",
                "链接中包含空格或控制字符",
                "連結中包含空白或控制字元",
                "링크에 공백이나 제어 문자가 포함되어 있습니다",
            ]),
        ));
    }
    ensure_max_chars(
        url,
        URL_MAX_CHARS,
        "url",
        locale::pick(["リンクが長すぎます", "The link is too long", "链接过长", "連結過長", "링크가 너무 깁니다"]),
    )?;
    Ok(url.to_owned())
}
