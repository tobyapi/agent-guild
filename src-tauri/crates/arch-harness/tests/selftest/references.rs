//! 参照の集め方: use の木の展開・マクロの中・コメントと文字列の無視・テストの範囲・コマンドの関数。

use arch_harness::module_path;
use arch_harness::references::{collect, CommandFn};

fn paths(text: &str) -> Vec<String> {
    let found = collect(text).unwrap_or_else(|error| panic!("構文解析できない: {error}"));
    found.references.iter().map(|reference| reference.segments.join("::")).collect()
}

#[test]
fn use_trees_are_expanded_into_full_paths() {
    let found = paths("use crate::{domain::Agent, infrastructure::{db::Db, self}};\nuse rusqlite::*;");
    assert_eq!(found, ["crate::domain::Agent", "crate::infrastructure::db::Db", "crate::infrastructure::self", "rusqlite::*"]);
}

#[test]
fn paths_inside_macros_are_found_but_comments_and_strings_are_not() {
    let text = "// crate::infrastructure::X\nfn f() { let s = \"crate::infrastructure\"; println!(\"{}\", tokio::spawn(g)); }";
    let found = paths(text);
    assert!(found.contains(&"tokio::spawn".to_owned()), "{found:?}");
    assert!(!found.iter().any(|path| path.contains("infrastructure")), "{found:?}");
}

#[test]
fn test_scopes_are_marked() {
    let text = "use a::b;\n#[cfg(test)]\nmod tests { use rusqlite::Connection; }\n#[test]\nfn t() { tokio::spawn(x); }";
    let found = collect(text).expect("構文解析できる");
    let marked: Vec<(String, bool)> =
        found.references.iter().map(|reference| (reference.segments.join("::"), reference.in_test)).collect();
    assert!(marked.contains(&("a::b".to_owned(), false)));
    assert!(marked.contains(&("rusqlite::Connection".to_owned(), true)));
    assert!(marked.contains(&("tokio::spawn".to_owned(), true)));
}

#[test]
fn tauri_commands_are_recorded_with_their_asyncness() {
    let text = "#[tauri::command]\nfn sync_one() {}\n\n#[tauri::command]\nasync fn async_one() {}\nfn plain() {}";
    let found = collect(text).expect("構文解析できる");
    assert_eq!(
        found.commands,
        [
            CommandFn { name: "sync_one".to_owned(), line: 2, is_async: false },
            CommandFn { name: "async_one".to_owned(), line: 5, is_async: true },
        ]
    );
}

#[test]
fn module_paths_and_relative_references_are_resolved() {
    assert_eq!(module_path::of_file("infrastructure/sqlite/mod.rs"), ["crate", "infrastructure", "sqlite"]);
    assert_eq!(module_path::of_file("lib.rs"), ["crate"]);
    let module = module_path::of_file("interface/commands/agents.rs");
    let resolve = |path: &str| module_path::resolve(&path.split("::").map(str::to_owned).collect::<Vec<_>>(), &module);
    assert_eq!(resolve("super::super::bootstrap::Boot"), ["crate", "interface", "bootstrap", "Boot"]);
    assert_eq!(resolve("super::super::super::bootstrap"), ["crate", "bootstrap"]);
    assert_eq!(resolve("self::helper"), ["crate", "interface", "commands", "agents", "helper"]);
    assert_eq!(resolve("crate::infrastructure::self"), ["crate", "infrastructure"]);
}
