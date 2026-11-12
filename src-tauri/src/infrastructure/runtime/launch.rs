//! ランナーの起動方法の組み立て。配布版はアプリに同梱した runner（リソースの runner/agent-runner/src/main.js。
//! scripts/stage-runner.mjs が作る）を同梱の Node.js で動かす。開発中は利用者の node で TypeScript を直接動かす。
//! Claude Code と Codex CLI は同梱しない（ランナーが利用者の環境のものを探す）。

use std::path::{Path, PathBuf};
use std::time::Duration;

use guild_domain::locale::Language;
use runner_client::{Launch, RunnerConfig};

use super::user_path;
use crate::infrastructure::plain_path::plain_path;

/// ready を待つ上限
const READY_TIMEOUT: Duration = Duration::from_secs(20);
/// cancel 後に終端イベントを待つ上限（design.md §5）
const CANCEL_GRACE: Duration = Duration::from_secs(10);
/// リソースのフォルダの中の、同梱の runner の置き場所
pub const BUNDLED_DIR: &str = "runner";
/// 同梱の runner の中のエントリ
const BUNDLED_SCRIPT: [&str; 3] = ["agent-runner", "src", "main.js"];

/// 起動方法: 環境変数 GUILD_RUNNER_SCRIPT があれば開発用。なければ、リソースに同梱の runner があればそれ、なければ開発用。
/// language は最初の言語（起動のたびに環境変数 GUILD_LANGUAGE で渡す。runner-client が以後の変更を覚える）
pub fn runner_config(resource_dir: Option<&Path>, language: Language) -> RunnerConfig {
    let explicit = std::env::var_os("GUILD_RUNNER_SCRIPT").is_some_and(|value| !value.is_empty());
    let bundled =
        resource_dir.map(|dir| dir.join(BUNDLED_DIR)).filter(|root| !explicit && bundled_script(root).is_file());
    let config = match bundled {
        Some(root) => bundled_config(&root),
        None => development_config(),
    };
    RunnerConfig { language: language.code().to_owned(), ..config }
}

/// 同梱の runner を、アプリの実行ファイルと同じフォルダにある Node.js で動かす。
/// macOS では CLI を探せるよう、ログインシェルの PATH をランナーに渡す。
/// Windows ではリソースのフォルダが `\\?\C:\...`（verbatim）で届くことがあり、Node はそれを扱えない（lstat 'C:' で落ちる）ので直す
fn bundled_config(root: &Path) -> RunnerConfig {
    let root = plain_path(root);
    let root = root.as_path();
    let node_name = format!("guild-node{}", std::env::consts::EXE_SUFFIX);
    let node = match std::env::current_exe() {
        Ok(app) => plain_path(&app.with_file_name(&node_name)),
        Err(error) => {
            log::warn!("アプリの実行ファイルの場所を取得できませんでした: {error}");
            root.join(node_name)
        }
    };
    let path = user_path::search_path();
    RunnerConfig {
        launch: Launch::Node { node, script: bundled_script(root) },
        args: Vec::new(),
        env: path.map(|value| vec![("PATH".to_owned(), value)]).unwrap_or_default(),
        cwd: Some(root.to_path_buf()),
        language: String::new(),
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
        language: String::new(),
        ready_timeout: READY_TIMEOUT,
        cancel_grace: CANCEL_GRACE,
    }
}

fn project_root() -> PathBuf {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest.parent().map_or_else(|| manifest.to_path_buf(), Path::to_path_buf)
}
