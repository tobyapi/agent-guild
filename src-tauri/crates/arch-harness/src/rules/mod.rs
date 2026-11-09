//! 各規則。どれも src-tauri/ のルートを受け取り、違反の一覧を返す。

pub mod dependencies;
pub mod layers;
pub mod placement;
pub mod size;
pub mod template_ids;
pub mod threads;

use std::path::Path;

use crate::files::{self, SourceFile};
use crate::references::FileReferences;
use crate::report::Violation;

/// 本体クレート（src-tauri/src）の .rs を構文解析したもの
pub(crate) fn main_crate(root: &Path) -> (Vec<(SourceFile, FileReferences)>, Vec<Violation>) {
    files::parse_rust(root, &["src".to_owned()])
}

/// 本体クレートのファイルのモジュールパス
pub(crate) fn module_of(file: &SourceFile) -> Vec<String> {
    crate::module_path::of_file(file.path.strip_prefix("src/").unwrap_or(&file.path))
}

/// path が prefix のどれかで始まるか（ディレクトリ単位の指定 "a/b/" と、そのモジュールファイル "a/b.rs" の両方を許す）
pub(crate) fn is_under(path: &str, dirs: &[&str]) -> bool {
    dirs.iter().any(|dir| path.starts_with(&format!("{dir}/")) || path == format!("{dir}.rs"))
}
