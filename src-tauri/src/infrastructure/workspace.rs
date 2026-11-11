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
use guild_domain::channel::ChannelWorkspace;
use guild_domain::ids::{AgentId, ChannelId};

use super::data_dir::{safe_component, AGENTS_DIR};
use super::file_manager;
use super::plain_path::plain_path;

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

    /// エージェント ID は自分で発行した UUID だが、画面から届いた文字列でもあるので、フォルダ名に使える形にしてから使う
    /// （".." や区切りを含む ID で agents/ の外を指させない。UUID はそのまま）
    fn root(&self, agent: &AgentId) -> PathBuf {
        self.agents_root.join(safe_component(agent.as_str()))
    }
}

impl Workspace for FsWorkspace {
    fn validate_folder(&self, folder: &str) -> AppResult<String> {
        let input = Path::new(folder);
        if !input.is_absolute() {
            return Err(AppError::validation("作業フォルダは絶対パスで指定してください"));
        }
        let path = fs::canonicalize(input).map_err(storage)?;
        if !path.is_dir() {
            return Err(AppError::validation("存在するフォルダを指定してください"));
        }
        let managed = fs::canonicalize(
            self.agents_root.parent().ok_or_else(|| AppError::validation("保存領域の親がありません"))?,
        )
        .map_err(storage)?;
        if path.starts_with(&managed) || managed.starts_with(&path) {
            return Err(AppError::validation("アプリの保存領域やその親フォルダは割り当てられません"));
        }
        // Windows の canonicalize は `\\?\C:\...` を返す。ランナー（Node）とそのパスの比較・OS の隔離の設定に渡すので、普通の形で保存する
        plain_path(&path)
            .to_str()
            .map(str::to_owned)
            .ok_or_else(|| AppError::validation("フォルダのパスを読み取れません"))
    }

    fn scoped_work_dir(&self, agent: &AgentId, channel: &ChannelId, revision: u64) -> PathBuf {
        self.root(agent).join("channels").join(safe_component(channel.as_str())).join(revision.to_string()).join("work")
    }

    fn prepare_scoped(
        &self,
        agent: &AgentId,
        backend: &str,
        channel: &ChannelId,
        scope: &ChannelWorkspace,
    ) -> AppResult<WorkspacePaths> {
        if let Some(folder) = &scope.folder {
            if self.validate_folder(folder)? != *folder {
                return Err(AppError::validation("割り当てフォルダの実体が変わりました。選び直してください"));
            }
        }
        let work = self.scoped_work_dir(agent, channel, scope.revision);
        let state = work
            .parent()
            .ok_or_else(|| AppError::validation("作業場所の親がありません"))?
            .join("state")
            .join(safe_component(backend));
        fs::create_dir_all(&work).map_err(storage)?;
        if state.exists() {
            fs::remove_dir_all(&state).map_err(storage)?;
        }
        fs::create_dir_all(&state).map_err(storage)?;
        Ok(WorkspacePaths { work, state })
    }

    fn read_scoped_memory(&self, agent: &AgentId, channel: &ChannelId, revision: u64) -> AppResult<String> {
        match fs::read_to_string(self.scoped_work_dir(agent, channel, revision).join(MEMORY_FILE)) {
            Ok(text) => Ok(text),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(String::new()),
            Err(error) => Err(storage(error)),
        }
    }

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

fn storage(error: io::Error) -> AppError {
    AppError::Storage(format!("作業フォルダを操作できませんでした: {error}"))
}
