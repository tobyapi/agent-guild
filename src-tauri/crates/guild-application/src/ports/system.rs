//! イベント・作業場所・再起動・時計・ID・タスク生成のポート。

use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;

use guild_domain::activity::ActivityState;
use guild_domain::channel::ChannelWorkspace;
use guild_domain::delegation::Delegation;
use guild_domain::ids::{AgentId, ChannelId};
use guild_domain::message::Message;

use crate::error::AppResult;

/// React へのイベント（名前とペイロードは design.md §4）
pub trait EventPublisher: Send + Sync {
    fn message_created(&self, message: &Message);
    fn activity_changed(&self, state: &ActivityState);
    fn state_changed(&self);
    fn skills_changed(&self, agent: &AgentId);
    fn skill_library_changed(&self);
    /// 割り振りが作られた・サブタスクや全体の状態が変わった（全体の最新の値）
    fn delegation_changed(&self, delegation: &Delegation);
}

/// エージェントの作業場所（agents/<id>/work）とアダプタの管理領域（agents/<id>/state/<backend>）
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspacePaths {
    pub work: PathBuf,
    pub state: PathBuf,
}

pub trait Workspace: Send + Sync {
    fn validate_folder(&self, _folder: &str) -> AppResult<String> {
        Err(crate::error::AppError::validation("フォルダ割り当てに対応していません"))
    }
    fn prepare_scoped(
        &self,
        _agent: &AgentId,
        _backend: &str,
        _channel: &ChannelId,
        _scope: &ChannelWorkspace,
    ) -> AppResult<WorkspacePaths> {
        Err(crate::error::AppError::validation("チャンネル別作業場所に対応していません"))
    }
    fn scoped_work_dir(&self, _agent: &AgentId, _channel: &ChannelId, _revision: u64) -> PathBuf {
        PathBuf::new()
    }
    fn read_scoped_memory(&self, _agent: &AgentId, _channel: &ChannelId, _revision: u64) -> AppResult<String> {
        Ok(String::new())
    }
    /// 実行の前に用意する: work/ を作り、state/<backend>/ を作り直す
    fn prepare(&self, agent: &AgentId, backend: &str) -> AppResult<WorkspacePaths>;
    /// work/ の場所（作らない。相談相手に読ませるときに使う）
    fn work_dir(&self, agent: &AgentId) -> PathBuf;
    /// work/MEMORY.md の内容（なければ空）
    fn read_memory(&self, agent: &AgentId) -> AppResult<String>;
    /// agents/<id>/ を消す（使用中なら再試行する）
    fn remove(&self, agent: &AgentId) -> AppResult<()>;
    /// OS のファイラで work/ を開く
    fn reveal(&self, agent: &AgentId) -> AppResult<()>;
}

pub trait AppControl: Send + Sync {
    /// アプリを再起動する（呼び出しから戻ったあとで終了処理が進む）
    fn restart(&self);
}

pub trait Clock: Send + Sync {
    /// UNIX ミリ秒（プロセス内で単調増加）
    fn now_ms(&self) -> i64;
    /// ローカル時刻の表示（例: "2026年11月8日(日) 15:30"）
    fn local_label(&self, ms: i64) -> String;
}

pub trait IdGenerator: Send + Sync {
    fn new_id(&self) -> String;
}

/// 生成するタスク
pub type BoxTask = Pin<Box<dyn Future<Output = ()> + Send + 'static>>;

/// タスクの生成（実装は tauri::async_runtime。テストでは tokio::spawn）
pub trait Spawner: Send + Sync {
    fn spawn(&self, task: BoxTask);
}
