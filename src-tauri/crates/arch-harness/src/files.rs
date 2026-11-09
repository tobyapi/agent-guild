//! 検査するファイルの列挙と読み込み。パスは src-tauri/ からの相対で、区切りは常に /。

use std::fs;
use std::path::Path;

use crate::references::{self, FileReferences};
use crate::report::Violation;

/// どこにあっても見ないディレクトリ
const EXCLUDED_DIRS: [&str; 4] = ["target", "node_modules", ".git", "dist"];

pub struct SourceFile {
    pub path: String,
    pub text: String,
}

/// root/<dirs> 以下で、名前が extensions のどれかで終わるファイル（無いディレクトリは飛ばす）
pub fn collect(root: &Path, dirs: &[String], extensions: &[&str]) -> Vec<SourceFile> {
    let mut files = Vec::new();
    for dir in dirs {
        walk(root, dir, extensions, &mut files);
    }
    files.sort_by(|a, b| a.path.cmp(&b.path));
    files
}

fn walk(root: &Path, dir: &str, extensions: &[&str], files: &mut Vec<SourceFile>) {
    let Ok(entries) = fs::read_dir(root.join(dir)) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let path = format!("{dir}/{name}");
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_dir() && !EXCLUDED_DIRS.contains(&name.as_str()) {
            walk(root, &path, extensions, files);
        } else if kind.is_file() && extensions.iter().any(|extension| name.ends_with(extension)) {
            if let Ok(text) = fs::read_to_string(entry.path()) {
                files.push(SourceFile { path, text });
            }
        }
    }
}

/// crates/ 直下のクレートの名前
pub fn crate_names(root: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(root.join("crates")) else {
        return Vec::new();
    };
    let mut names: Vec<String> = entries
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    names
}

/// root/<dirs> 以下の .rs を構文解析する。解析できないファイルは違反として返す（黙って見逃さない）
pub fn parse_rust(root: &Path, dirs: &[String]) -> (Vec<(SourceFile, FileReferences)>, Vec<Violation>) {
    let mut parsed = Vec::new();
    let mut failures = Vec::new();
    for file in collect(root, dirs, &[".rs"]) {
        match references::collect(&file.text) {
            Ok(found) => parsed.push((file, found)),
            Err(error) => {
                let line = error.span().start().line;
                let advice = format!("構文解析できません（{error}）。コンパイルが通る形に直す");
                failures.push(Violation::new(&file.path, line, "syntax", advice));
            }
        }
    }
    (parsed, failures)
}
