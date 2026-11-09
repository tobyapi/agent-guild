//! 1ファイルの空行を除いた行数は 150 行未満。対象は src-tauri/src と crates/*/src・crates/*/tests の
//! .rs / .ts / .tsx / .css / .mjs（テスト用の偽ランナーなども含む）。

use std::path::Path;

use crate::files;
use crate::report::Violation;

/// 空行を除いた行数がこの値に達したら違反（= 149 行まで）
pub const LINE_LIMIT: usize = 150;
const EXTENSIONS: [&str; 5] = [".rs", ".ts", ".tsx", ".css", ".mjs"];

pub fn check(root: &Path) -> Vec<Violation> {
    let mut dirs = vec!["src".to_owned()];
    for name in files::crate_names(root) {
        dirs.push(format!("crates/{name}/src"));
        dirs.push(format!("crates/{name}/tests"));
    }
    files::collect(root, &dirs, &EXTENSIONS)
        .iter()
        .filter_map(|file| {
            let (count, overflow_line) = count_lines(&file.text);
            let advice = format!("空行を除いて {count} 行（上限 {} 行）。責務ごとにモジュールを分割する", LINE_LIMIT - 1);
            overflow_line.map(|line| Violation::new(&file.path, line, "max-lines", advice))
        })
        .collect()
}

/// 空行を除いた行数と、上限に達した行（1 始まり。達していなければ None）
pub fn count_lines(text: &str) -> (usize, Option<usize>) {
    let mut count = 0;
    let mut overflow_line = None;
    for (index, line) in text.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        count += 1;
        if count == LINE_LIMIT {
            overflow_line = Some(index + 1);
        }
    }
    (count, overflow_line)
}
