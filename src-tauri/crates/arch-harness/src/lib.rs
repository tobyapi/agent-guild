//! 保守性ハーネス（Rust 側）: CLAUDE.md の Rust 節の規約を、ソースを syn で構文解析して機械的に検査する。
//! 規則は `rules` の各モジュール。実行は tests/architecture.rs の各テストで、違反があれば
//! 「ファイル:行 規則名 — 直し方」を並べて失敗する。
//!
//! 依存の向き guild-domain ← guild-application ← 本体 はクレートの依存でコンパイラが強制するので、
//! ここでは本体クレートの中の規則・配置・内側のクレートの依存（Cargo.toml）・行数を見る。

pub mod files;
pub mod literals;
pub mod module_path;
pub mod references;
pub mod report;
pub mod rules;

use std::path::PathBuf;

/// src-tauri/（ワークスペースのルート）
pub fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}
