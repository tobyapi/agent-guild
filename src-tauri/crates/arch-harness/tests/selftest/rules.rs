//! 本体クレートの規則: レイヤーの分離・配置・async コマンド・タスクの生成・構文エラー。

use arch_harness::rules::{layers, placement, threads};

use crate::fixture::{summary, Workspace};

#[test]
fn interface_and_infrastructure_must_not_reference_each_other_or_bootstrap() {
    let workspace = Workspace::new("layers", &[
        ("src/lib.rs", "use crate::infrastructure::Db;\nuse crate::bootstrap::start;"),
        ("src/interface/commands/agents.rs", "use crate::interface::state::State;\nuse crate::infrastructure::sqlite::Db;\nfn f() { super::super::super::bootstrap::start(); }"),
        ("src/interface/state.rs", "fn g() { let _ = format!(\"{}\", crate::infrastructure::clock::now()); }"),
        ("src/infrastructure/events.rs", "use crate::interface::commands;\nuse guild_application::ports::EventPublisher;"),
    ]);
    assert_eq!(
        summary(&layers::check(&workspace.root)),
        [
            "src/infrastructure/events.rs:1 layer-dependency",
            "src/interface/commands/agents.rs:2 layer-dependency",
            "src/interface/commands/agents.rs:3 layer-dependency",
            "src/interface/state.rs:1 layer-dependency",
        ]
    );
}

#[test]
fn tauri_rusqlite_and_runner_client_stay_in_their_directories() {
    let workspace = Workspace::new(
        "placement",
        &[
            ("src/interface/commands/agents.rs", "#[tauri::command]\npub async fn list() {}"),
            ("src/infrastructure/sqlite/repo.rs", "use rusqlite::Connection;"),
            ("src/infrastructure/runtime/mod.rs", "use runner_client::RunnerClient;"),
            ("src/infrastructure/workspace.rs", "fn f(c: &rusqlite::Connection) {}"),
            ("src/bootstrap/mod.rs", "use runner_client::{Launch, RunnerConfig};"),
            ("src/lib.rs", "#[tauri::command]\nasync fn stray() {}"),
        ],
    );
    assert_eq!(
        summary(&placement::check(&workspace.root)),
        [
            "src/bootstrap/mod.rs:1 runner-client-placement",
            "src/bootstrap/mod.rs:1 runner-client-placement",
            "src/infrastructure/workspace.rs:1 rusqlite-placement",
            "src/lib.rs:1 tauri-command-placement",
        ]
    );
}

#[test]
fn tauri_commands_must_be_async() {
    let workspace = Workspace::new(
        "async",
        &[(
            "src/interface/commands/channels.rs",
            "#[tauri::command]\npub async fn ok() {}\n\n#[tauri::command]\npub fn blocking() {}",
        )],
    );
    assert_eq!(
        summary(&placement::check_async_commands(&workspace.root)),
        ["src/interface/commands/channels.rs:5 tauri-command-async"]
    );
}

#[test]
fn tasks_are_spawned_only_through_the_port() {
    let workspace = Workspace::new(
        "threads",
        &[
            (
                "crates/guild-application/src/conversation/dispatcher.rs",
                "fn f() { tokio::spawn(run()); }\n#[cfg(test)]\nmod tests { fn t() { tokio::spawn(x()); } }",
            ),
            ("crates/guild-domain/src/lib.rs", "use std::thread;\nfn g() { thread::spawn(|| {}); }"),
            ("src/interface/commands/x.rs", "use tokio::task::spawn_blocking;"),
            ("src/infrastructure/spawner.rs", "fn s() { tauri::async_runtime::spawn(f()); }"),
        ],
    );
    assert_eq!(
        summary(&threads::check(&workspace.root)),
        [
            "crates/guild-application/src/conversation/dispatcher.rs:1 spawn-through-port",
            "crates/guild-domain/src/lib.rs:2 spawn-through-port",
            "src/interface/commands/x.rs:1 spawn-through-port",
        ]
    );
}

#[test]
fn unparsable_files_are_reported_instead_of_skipped() {
    let workspace = Workspace::new("syntax", &[("src/interface/broken.rs", "fn f( {")]);
    let found = summary(&layers::check(&workspace.root));
    assert_eq!(found.len(), 1);
    assert!(found[0].starts_with("src/interface/broken.rs:") && found[0].ends_with(" syntax"), "{found:?}");
}
