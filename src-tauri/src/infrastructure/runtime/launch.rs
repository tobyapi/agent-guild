//! ランナーの起動方法の組み立て。開発中は node でスクリプトを直接実行する
//! （配布用の単一バイナリを bundle.externalBin で同梱するのは後続タスク）。

use std::path::{Path, PathBuf};
use std::time::Duration;

use runner_client::{Launch, RunnerConfig};

/// ready を待つ上限
const READY_TIMEOUT: Duration = Duration::from_secs(20);
/// cancel 後に終端イベントを待つ上限（design.md §5）
const CANCEL_GRACE: Duration = Duration::from_secs(10);

/// スクリプトは環境変数 GUILD_RUNNER_SCRIPT、なければ <CARGO_MANIFEST_DIR>/../agent-runner/src/main.ts。
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
