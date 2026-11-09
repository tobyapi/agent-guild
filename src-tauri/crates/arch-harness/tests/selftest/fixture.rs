//! 一時ディレクトリに作る小さなワークスペース（捨てられたら消す）。

use std::fs;
use std::path::PathBuf;

use arch_harness::report::Violation;

pub struct Workspace {
    pub root: PathBuf,
}

impl Workspace {
    /// name はテストごとに変える（並列に走るので）。files は (src-tauri/ からのパス, 内容)
    pub fn new(name: &str, files: &[(&str, &str)]) -> Self {
        let root = std::env::temp_dir().join(format!("arch-harness-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        for (path, text) in files {
            let path = root.join(path);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).unwrap_or_else(|error| panic!("{}: {error}", parent.display()));
            }
            fs::write(&path, text).unwrap_or_else(|error| panic!("{}: {error}", path.display()));
        }
        Self { root }
    }
}

impl Drop for Workspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

/// 違反を「ファイル:行 規則名」の一覧にする
pub fn summary(violations: &[Violation]) -> Vec<String> {
    violations.iter().map(|violation| format!("{}:{} {}", violation.file, violation.line, violation.rule)).collect()
}
