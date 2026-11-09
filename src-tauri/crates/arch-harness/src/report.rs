//! 違反の表し方と報告の形。

use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Violation {
    /// src-tauri/ からの相対パス（区切りは /）
    pub file: String,
    pub line: usize,
    pub rule: &'static str,
    /// 直し方
    pub advice: String,
}

impl Violation {
    pub fn new(file: &str, line: usize, rule: &'static str, advice: impl Into<String>) -> Self {
        Self { file: file.to_owned(), line, rule, advice: advice.into() }
    }
}

impl fmt::Display for Violation {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "src-tauri/{}:{} {} — {}", self.file, self.line, self.rule, self.advice)
    }
}

/// 「ファイル:行 規則名 — 直し方」を1件1行で並べる
pub fn format(violations: &[Violation]) -> String {
    violations.iter().map(ToString::to_string).collect::<Vec<_>>().join("\n")
}
