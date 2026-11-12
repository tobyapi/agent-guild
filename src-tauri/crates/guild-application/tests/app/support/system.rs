//! 作業場所・時計・ID・タスク生成・フォルダ・設定・再起動のフェイク（イベントは events.rs）。

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicUsize, Ordering};

use guild_application::ports::{
    AppControl, BoxTask, Clock, DataExporter, FolderState, Folders, IdGenerator, LaunchSettings, SettingsStore,
    Spawner, TargetFolder, Workspace, WorkspacePaths,
};
use guild_application::{AppError, AppResult};
use guild_domain::channel::ChannelWorkspace;
use guild_domain::ids::{AgentId, ChannelId};
use parking_lot::Mutex;

#[derive(Default)]
pub struct FakeWorkspace {
    pub removed: Mutex<Vec<AgentId>>,
    pub memory: Mutex<String>,
}

impl Workspace for FakeWorkspace {
    fn validate_folder(&self, folder: &str) -> AppResult<String> {
        if !Path::new(folder).is_absolute() {
            return Err(AppError::validation("absolute path required"));
        }
        Ok(folder.to_owned())
    }
    fn scoped_work_dir(&self, agent: &AgentId, channel: &ChannelId, revision: u64) -> PathBuf {
        PathBuf::from("/ws")
            .join(agent.as_str())
            .join("channels")
            .join(channel.as_str())
            .join(revision.to_string())
            .join("work")
    }
    fn prepare_scoped(
        &self,
        agent: &AgentId,
        backend: &str,
        channel: &ChannelId,
        scope: &ChannelWorkspace,
    ) -> AppResult<WorkspacePaths> {
        let work = self.scoped_work_dir(agent, channel, scope.revision);
        Ok(WorkspacePaths {
            state: work.parent().ok_or_else(|| AppError::validation("missing parent"))?.join("state").join(backend),
            work,
        })
    }
    fn read_scoped_memory(&self, _agent: &AgentId, _channel: &ChannelId, _revision: u64) -> AppResult<String> {
        Ok(String::new())
    }

    fn prepare(&self, agent: &AgentId, backend: &str) -> AppResult<WorkspacePaths> {
        let root = PathBuf::from("/ws").join(agent.as_str());
        Ok(WorkspacePaths { work: root.join("work"), state: root.join("state").join(backend) })
    }
    fn work_dir(&self, agent: &AgentId) -> PathBuf {
        PathBuf::from("/ws").join(agent.as_str()).join("work")
    }
    fn read_memory(&self, _agent: &AgentId) -> AppResult<String> {
        Ok(self.memory.lock().clone())
    }
    fn remove(&self, agent: &AgentId) -> AppResult<()> {
        self.removed.lock().push(agent.clone());
        Ok(())
    }
    fn reveal(&self, _agent: &AgentId) -> AppResult<()> {
        Ok(())
    }
}

/// 呼ぶたびに 1 ミリ秒進む時計
pub struct FakeClock(AtomicI64);

impl FakeClock {
    pub fn starting_at(ms: i64) -> Self {
        Self(AtomicI64::new(ms))
    }
}

impl Clock for FakeClock {
    fn now_ms(&self) -> i64 {
        self.0.fetch_add(1, Ordering::SeqCst)
    }
    fn local_label(&self, ms: i64) -> String {
        format!("t{ms}")
    }
}

#[derive(Default)]
pub struct FakeIds(AtomicUsize);

impl IdGenerator for FakeIds {
    fn new_id(&self) -> String {
        format!("id-{}", self.0.fetch_add(1, Ordering::SeqCst) + 1)
    }
}

pub struct TokioSpawner;

impl Spawner for TokioSpawner {
    fn spawn(&self, task: BoxTask) {
        tokio::spawn(task);
    }
}

/// inspect の答えを差し替えられるフォルダ
pub struct FakeFolders {
    pub answer: Mutex<TargetFolder>,
    pub revealed: Mutex<Vec<PathBuf>>,
}

impl Default for FakeFolders {
    fn default() -> Self {
        let empty = TargetFolder { state: FolderState::Empty, is_current: false, is_nested: false, is_default: false };
        Self { answer: Mutex::new(empty), revealed: Mutex::default() }
    }
}

impl Folders for FakeFolders {
    fn inspect(&self, _dir: &Path) -> AppResult<TargetFolder> {
        Ok(self.answer.lock().clone())
    }
    fn reveal(&self, dir: &Path) -> AppResult<()> {
        self.revealed.lock().push(dir.to_path_buf());
        Ok(())
    }
}

#[derive(Default)]
pub struct FakeExporter {
    pub exported: Mutex<Vec<PathBuf>>,
    pub fail: AtomicBool,
}

impl DataExporter for FakeExporter {
    fn export_to(&self, dir: &Path) -> AppResult<()> {
        if self.fail.load(Ordering::SeqCst) {
            return Err(AppError::Storage("ディスクがいっぱいです".to_owned()));
        }
        self.exported.lock().push(dir.to_path_buf());
        Ok(())
    }
}

#[derive(Default)]
pub struct FakeSettings {
    pub saved: Mutex<Vec<LaunchSettings>>,
}

impl SettingsStore for FakeSettings {
    fn load(&self) -> AppResult<LaunchSettings> {
        Ok(self.saved.lock().last().cloned().unwrap_or_default())
    }
    fn save(&self, settings: &LaunchSettings) -> AppResult<()> {
        self.saved.lock().push(settings.clone());
        Ok(())
    }
}

#[derive(Default)]
pub struct FakeControl {
    pub restarts: AtomicUsize,
}

impl AppControl for FakeControl {
    fn restart(&self) {
        self.restarts.fetch_add(1, Ordering::SeqCst);
    }
}
