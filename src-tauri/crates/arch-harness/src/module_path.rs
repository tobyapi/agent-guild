//! ファイルのモジュールパス（crate::a::b）と、self:: / super:: で始まる参照の絶対パスへの解決。

/// クレートの src/ からの相対パス → モジュールパス。
/// "infrastructure/sqlite/mod.rs" → [crate, infrastructure, sqlite]、"lib.rs" → [crate]
pub fn of_file(path_in_src: &str) -> Vec<String> {
    let mut parts = vec!["crate".to_owned()];
    parts.extend(path_in_src.trim_end_matches(".rs").split('/').map(str::to_owned));
    if matches!(parts.last().map(String::as_str), Some("lib" | "main" | "mod")) {
        parts.pop();
    }
    parts
}

/// self:: / super:: で始まる参照を crate:: から始まる形にする（それ以外はそのまま）。
/// ファイルの中のインラインのモジュール（mod tests { … }）は数えない近似だが、コンパイルできるコードでは
/// 誤って別のレイヤーを指すことはない。
pub fn resolve(segments: &[String], module: &[String]) -> Vec<String> {
    let mut rest = segments;
    let mut base = match segments.first().map(String::as_str) {
        Some("self") => {
            rest = &segments[1..];
            module.to_vec()
        }
        Some("super") => {
            let mut base = module.to_vec();
            while rest.first().map(String::as_str) == Some("super") {
                base.pop();
                rest = &rest[1..];
            }
            base
        }
        _ => return segments.iter().filter(|segment| *segment != "self").cloned().collect(),
    };
    base.extend(rest.iter().filter(|segment| *segment != "self").cloned());
    base
}
