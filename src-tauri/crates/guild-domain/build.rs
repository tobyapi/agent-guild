//! 内蔵スキル（`src/shared/assets/skills/<name>/`）を埋め込むための表を生成する。
//! フォルダを足すだけで内蔵スキルが増える。SKILL.md 以外のファイルは付属ファイル（UTF-8 のテキスト）として埋め込む。

use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    let manifest = PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").unwrap_or_default());
    let root = manifest.join("../../../src/shared/assets/skills");
    println!("cargo:rerun-if-changed={}", root.display());
    let mut code = String::from("&[\n");
    for folder in sorted_entries(&root).into_iter().filter(|path| path.is_dir()) {
        let name = file_name(&folder);
        let skill_md = folder.join("SKILL.md");
        let _ =
            writeln!(code, "    BundledSkill {{\n        folder: {name:?},\n        skill_md: {},", include(&skill_md));
        code.push_str("        files: &[\n");
        let mut files = Vec::new();
        collect_files(&folder, &folder, &mut files);
        for (relative, path) in files {
            let _ = writeln!(code, "            ({relative:?}, {}),", include(&path));
        }
        code.push_str("        ],\n    },\n");
    }
    code.push(']');
    let out = PathBuf::from(std::env::var_os("OUT_DIR").unwrap_or_default()).join("builtin_skills.rs");
    if let Err(error) = fs::write(&out, code) {
        panic!("{}: {error}", out.display());
    }
}

/// SKILL.md 以外のファイル（フォルダからの相対パスは / 区切り）。隠しファイルはたどらない
fn collect_files(base: &Path, dir: &Path, files: &mut Vec<(String, PathBuf)>) {
    println!("cargo:rerun-if-changed={}", dir.display());
    for path in sorted_entries(dir) {
        let name = file_name(&path);
        if name.starts_with('.') || (dir == base && name == "SKILL.md") {
            continue;
        }
        if path.is_dir() {
            collect_files(base, &path, files);
        } else if let Ok(relative) = path.strip_prefix(base) {
            let relative: Vec<String> = relative.iter().map(|part| part.to_string_lossy().into_owned()).collect();
            files.push((relative.join("/"), path));
        }
    }
}

fn sorted_entries(dir: &Path) -> Vec<PathBuf> {
    let mut entries: Vec<PathBuf> = match fs::read_dir(dir) {
        Ok(entries) => entries.filter_map(Result::ok).map(|entry| entry.path()).collect(),
        Err(error) => panic!("{}: {error}", dir.display()),
    };
    entries.sort();
    entries
}

fn file_name(path: &Path) -> String {
    path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default()
}

fn include(path: &Path) -> String {
    println!("cargo:rerun-if-changed={}", path.display());
    format!("include_str!({:?})", path.display().to_string())
}
