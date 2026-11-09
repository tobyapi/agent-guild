//! 外界とつながるものの置き場所（本体クレート）: #[tauri::command] は src/interface/commands/、rusqlite は
//! src/infrastructure/sqlite/、runner_client は src/infrastructure/runtime/ だけ。Tauri コマンドはすべて async fn。

use std::path::Path;

use crate::report::Violation;

struct Placement {
    rule: &'static str,
    matches: fn(&[String]) -> bool,
    allowed: &'static [&'static str],
    advice: &'static str,
}

fn is_tauri_command(segments: &[String]) -> bool {
    segments == ["tauri", "command"]
}

fn is_rusqlite(segments: &[String]) -> bool {
    segments.first().is_some_and(|first| first == "rusqlite")
}

fn is_runner_client(segments: &[String]) -> bool {
    segments.first().is_some_and(|first| first == "runner_client")
}

const PLACEMENTS: [Placement; 3] = [
    Placement {
        rule: "tauri-command-placement",
        matches: is_tauri_command,
        allowed: &["src/interface/commands"],
        advice: "#[tauri::command] は src/interface/commands/ にだけ書く。薄いハンドラをそこへ移し、処理は guild-application のサービスへ",
    },
    Placement {
        rule: "rusqlite-placement",
        matches: is_rusqlite,
        allowed: &["src/infrastructure/sqlite"],
        advice: "rusqlite は src/infrastructure/sqlite/ にだけ書く。DB の操作はリポジトリ（ポートの実装）に閉じ込める",
    },
    Placement {
        rule: "runner-client-placement",
        matches: is_runner_client,
        allowed: &["src/infrastructure/runtime"],
        advice: "runner_client は src/infrastructure/runtime/ にだけ書く。AgentRuntime の実装と Launch の組み立てに閉じ込める",
    },
];

pub fn check(root: &Path) -> Vec<Violation> {
    let (parsed, mut violations) = super::main_crate(root);
    for (file, found) in &parsed {
        for placement in PLACEMENTS.iter().filter(|placement| !super::is_under(&file.path, placement.allowed)) {
            for reference in found.references.iter().filter(|reference| (placement.matches)(&reference.segments)) {
                violations.push(Violation::new(&file.path, reference.line, placement.rule, placement.advice));
            }
        }
    }
    violations
}

/// Tauri コマンドはすべて async fn（同期コマンドはメインスレッドで動き、UI を止める）
pub fn check_async_commands(root: &Path) -> Vec<Violation> {
    let (parsed, mut violations) = super::main_crate(root);
    for (file, found) in &parsed {
        for command in found.commands.iter().filter(|command| !command.is_async) {
            let advice = format!(
                "コマンド {} を async fn にする（同期コマンドはメインスレッドで動き、UI を止める）",
                command.name
            );
            violations.push(Violation::new(&file.path, command.line, "tauri-command-async", advice));
        }
    }
    violations
}
