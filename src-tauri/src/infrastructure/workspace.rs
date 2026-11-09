//! エージェントの作業場所（Workspace の実装。design.md §11）:
//!   agents/<id>/work/            エージェントの作業場所（cwd）。MEMORY.md と成果物
//!   agents/<id>/state/<backend>/ ランナーのアダプタの管理領域。実行のたびに作り直す

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use guild_application::ports::{Workspace, WorkspacePaths};
use guild_application::{AppError, AppResult};
use guild_domain::ids::AgentId;

use super::data_dir::AGENTS_DIR;
use super::file_manager;

const MEMORY_FILE: &str = "MEMORY.md";
/// Windows で使用中のファイルが消せないときの再試行
const REMOVE_ATTEMPTS: u32 = 5;
const REMOVE_INTERVAL: Duration = Duration::from_millis(200);

pub struct FsWorkspace {
    agents_root: PathBuf,
}

impl FsWorkspace {
    pub fn new(data_dir: &Path) -> Self {
        Self { agents_root: data_dir.join(AGENTS_DIR) }
    }

    /// エージェント ID は自分で発行した UUID なので、そのままフォルダ名にしてよい
    fn root(&self, agent: &AgentId) -> PathBuf {
        self.agents_root.join(agent.as_str())
    }
}

impl Workspace for FsWorkspace {
    fn prepare(&self, agent: &AgentId, backend: &str) -> AppResult<WorkspacePaths> {
        let work = self.work_dir(agent);
        let state = self.root(agent).join("state").join(safe_component(backend));
        fs::create_dir_all(&work).map_err(storage)?;
        if state.exists() {
            fs::remove_dir_all(&state).map_err(storage)?;
        }
        fs::create_dir_all(&state).map_err(storage)?;
        Ok(WorkspacePaths { work, state })
    }

    fn work_dir(&self, agent: &AgentId) -> PathBuf {
        self.root(agent).join("work")
    }

    fn read_memory(&self, agent: &AgentId) -> AppResult<String> {
        match fs::read_to_string(self.work_dir(agent).join(MEMORY_FILE)) {
            Ok(text) => Ok(text),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(String::new()),
            Err(error) => Err(storage(error)),
        }
    }

    fn remove(&self, agent: &AgentId) -> AppResult<()> {
        let root = self.root(agent);
        let mut attempt = 1;
        loop {
            match fs::remove_dir_all(&root) {
                Ok(()) => return Ok(()),
                Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(()),
                Err(_) if attempt < REMOVE_ATTEMPTS => thread::sleep(REMOVE_INTERVAL),
                Err(error) => return Err(storage(error)),
            }
            attempt += 1;
        }
    }

    fn reveal(&self, agent: &AgentId) -> AppResult<()> {
        let work = self.work_dir(agent);
        fs::create_dir_all(&work).map_err(storage)?;
        file_manager::reveal(&work).map_err(|e| AppError::Storage(format!("フォルダを開けませんでした（{e}）")))
    }
}

/// バックエンド ID をフォルダ名に使える形にする（英数字・ハイフン・アンダースコア以外は "_"）
fn safe_component(backend: &str) -> String {
    let name: String = backend
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    if name.is_empty() { "_".to_owned() } else { name }
}

fn storage(error: io::Error) -> AppError {
    AppError::Storage(format!("作業フォルダを操作できませんでした: {error}"))
}
