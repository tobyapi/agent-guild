//! タスクの生成は Spawner ポート経由: guild-domain・guild-application と本体の interface は、tokio::spawn などを
//! 直接呼ばない（テストのコードは除く）。parking_lot のガードを await をまたいで持たない規約は、
//! 既定で有効な clippy::await_holding_lock が `cargo clippy -D warnings` で検査する。

use std::path::Path;

use crate::files;
use crate::report::Violation;

const SCOPES: [&str; 3] = ["crates/guild-domain/src", "crates/guild-application/src", "src/interface"];

const SPAWN_PATHS: [&[&str]; 8] = [
    &["tokio", "spawn"],
    &["tokio", "task", "spawn"],
    &["tokio", "task", "spawn_blocking"],
    &["tokio", "task", "spawn_local"],
    &["std", "thread", "spawn"],
    &["thread", "spawn"],
    &["tauri", "async_runtime", "spawn"],
    &["tauri", "async_runtime", "spawn_blocking"],
];

pub fn check(root: &Path) -> Vec<Violation> {
    let dirs: Vec<String> = SCOPES.iter().map(|scope| (*scope).to_owned()).collect();
    let (parsed, mut violations) = files::parse_rust(root, &dirs);
    for (file, found) in &parsed {
        for reference in found.references.iter().filter(|reference| !reference.in_test && is_spawn(&reference.segments))
        {
            let advice = format!(
                "{} を直接呼ばない。タスクの生成は guild-application のポートの Spawner 経由にする（実装は infrastructure）",
                reference.segments.join("::")
            );
            violations.push(Violation::new(&file.path, reference.line, "spawn-through-port", advice));
        }
    }
    violations
}

fn is_spawn(segments: &[String]) -> bool {
    SPAWN_PATHS.iter().any(|spawn| segments.iter().map(String::as_str).eq(spawn.iter().copied()))
}
