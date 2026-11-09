//! 保守性ハーネス（Rust）: CLAUDE.md の Rust 節の規約を、実際のソース（src-tauri/）に対して検査する。
//! 違反があれば「ファイル:行 規則名 — 直し方」を並べて失敗する。

use arch_harness::report::{self, Violation};
use arch_harness::rules::{dependencies, layers, placement, size, template_ids, threads};
use arch_harness::workspace_root;

fn assert_clean(violations: &[Violation]) {
    assert!(
        violations.is_empty(),
        "保守性ハーネスの違反 {} 件:\n{}",
        violations.len(),
        report::format(violations)
    );
}

#[test]
fn files_stay_under_the_line_limit() {
    assert_clean(&size::check(&workspace_root()));
}

#[test]
fn interface_and_infrastructure_stay_apart() {
    assert_clean(&layers::check(&workspace_root()));
}

#[test]
fn tauri_sqlite_and_runner_stay_in_their_places() {
    assert_clean(&placement::check(&workspace_root()));
}

#[test]
fn tauri_commands_are_async() {
    assert_clean(&placement::check_async_commands(&workspace_root()));
}

#[test]
fn tasks_are_spawned_through_the_spawner_port() {
    assert_clean(&threads::check(&workspace_root()));
}

#[test]
fn template_ids_stay_in_the_template_table() {
    assert_clean(&template_ids::check(&workspace_root()));
}

#[test]
fn inner_crates_depend_only_on_allowed_crates() {
    assert_clean(&dependencies::check(&workspace_root()));
}
