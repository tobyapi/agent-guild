//! ランナーの起動方法の組み立て。配布版はアプリに同梱した runner（リソースの runner/agent-runner/src/main.js。
//! scripts/stage-runner.mjs が作る）を、開発中はリポジトリの agent-runner/src/main.ts を、どちらも利用者の環境の node で動かす。
//! Claude Code と Codex CLI は同梱しない（ランナーが利用者の環境のものを探す）。

use std::path::{Path, PathBuf};
use std::time::Duration;

use runner_client::{Launch, RunnerConfig};

use super::user_path;

/// ready を待つ上限
const READY_TIMEOUT: Duration = Duration::from_secs(20);
/// cancel 後に終端イベントを待つ上限（design.md §5）
const CANCEL_GRACE: Duration = Duration::from_secs(10);
/// リソースのフォルダの中の、同梱の runner の置き場所
pub const BUNDLED_DIR: &str = "runner";
/// 同梱の runner の中のエントリ
const BUNDLED_SCRIPT: [&str; 3] = ["agent-runner", "src", "main.js"];

/// 起動方法: 環境変数 GUILD_RUNNER_SCRIPT があれば開発用。なければ、リソースに同梱の runner があればそれ、なければ開発用
pub fn runner_config(resource_dir: Option<&Path>) -> RunnerConfig {
    let explicit = std::env::var_os("GUILD_RUNNER_SCRIPT").is_some_and(|value| !value.is_empty());
    let bundled = resource_dir
        .map(|dir| dir.join(BUNDLED_DIR))
        .filter(|root| !explicit && bundled_script(root).is_file());
    match bundled {
        Some(root) => bundled_config(&root),
        None => development_config(),
    }
}

/// 同梱の runner を、利用者の環境の node で動かす（macOS ではログインシェルの PATH を渡す）
fn bundled_config(root: &Path) -> RunnerConfig {
    let path = user_path::search_path();
    let node = user_path::find_program("node", path.as_deref()).unwrap_or_else(|| PathBuf::from("node"));
    RunnerConfig {
        launch: Launch::Node { node, script: bundled_script(root) },
        args: Vec::new(),
        env: path.map(|value| vec![("PATH".to_owned(), value)]).unwrap_or_default(),
        cwd: Some(root.to_path_buf()),
        ready_timeout: READY_TIMEOUT,
        cancel_grace: CANCEL_GRACE,
    }
}

fn bundled_script(root: &Path) -> PathBuf {
    BUNDLED_SCRIPT.iter().fold(root.to_path_buf(), |path, part| path.join(part))
}

/// 開発用: スクリプトは環境変数 GUILD_RUNNER_SCRIPT、なければ <CARGO_MANIFEST_DIR>/../agent-runner/src/main.ts。
/// 作業ディレクトリはプロジェクトのルート
pub fn development_config() -> RunnerConfig {
    let root = project_root();
    let script = std::env::var_os("GUILD_RUNNER_SCRIPT")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| root.join("agent-runner").join("src").join("main.ts"));
    RunnerConfig {
        launch: Launch::Node { node: PathBuf::from("node"), script },
        args: Vec::new(),
        env: Vec::new(),
        cwd: Some(root),
        ready_timeout: READY_TIMEOUT,
        cancel_grace: CANCEL_GRACE,
    }
}

fn project_root() -> PathBuf {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest.parent().map_or_else(|| manifest.to_path_buf(), Path::to_path_buf)
}
