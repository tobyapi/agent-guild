//! 組み立てのテスト（Tauri なし）: データフォルダを開く手順と初期データ。

mod boot;
mod seed;

use std::fs;
use std::path::PathBuf;

use async_trait::async_trait;
use guild_application::ports::{
    AgentRuntime, AppControl, EventPublisher, ImageRuntimeRequest, RuntimeError, RuntimeRequest, UpdateSink,
};
use guild_domain::activity::ActivityState;
use guild_domain::backend::{BackendInfo, InstallGuide, RuntimeStatus, StartSpec};
use guild_domain::delegation::Delegation;
use guild_domain::ids::AgentId;
use guild_domain::message::Message;

/// 一意な一時フォルダ（最後に消す）
pub(super) struct TempDir(pub PathBuf);

impl TempDir {
    pub fn new(name: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("guild-boot-{name}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// ランナーなし（バックエンドは空、実行は失敗）
pub(super) struct NoRuntime;

#[async_trait]
impl AgentRuntime for NoRuntime {
    fn status(&self) -> RuntimeStatus {
        RuntimeStatus::starting()
    }
    fn backends(&self) -> Vec<BackendInfo> {
        Vec::new()
    }
    async fn run(
        &self,
        _job_id: &str,
        _request: RuntimeRequest,
        _on_update: UpdateSink,
    ) -> Result<String, RuntimeError> {
        Err(RuntimeError::Failed("テストではランナーを使いません".to_owned()))
    }
    async fn generate_image(
        &self,
        _job_id: &str,
        _request: ImageRuntimeRequest,
        _on_update: UpdateSink,
    ) -> Result<(), RuntimeError> {
        Err(RuntimeError::Failed("テストではランナーを使いません".to_owned()))
    }
    async fn cancel(&self, _job_id: &str) {}
    async fn probe(&self) -> Result<(), RuntimeError> {
        Ok(())
    }
    async fn install_cli(&self, _guide: &InstallGuide) -> Result<(), RuntimeError> {
        Err(RuntimeError::Failed("テストではランナーを使いません".to_owned()))
    }
    async fn start(&self, _label: &str, _spec: &StartSpec) -> Result<(), RuntimeError> {
        Err(RuntimeError::Failed("テストではランナーを使いません".to_owned()))
    }
    async fn login(&self, _backend: &str) -> Result<(), RuntimeError> {
        Err(RuntimeError::Failed("テストではランナーを使いません".to_owned()))
    }
    async fn api_key(&self, _backend: &str, _action: &str, _key: Option<&str>) -> Result<String, RuntimeError> {
        Err(RuntimeError::Failed("テストではランナーを使いません".to_owned()))
    }
}

/// イベントを捨てる
pub(super) struct Silent;

impl EventPublisher for Silent {
    fn message_created(&self, _message: &Message) {}
    fn activity_changed(&self, _state: &ActivityState) {}
    fn state_changed(&self) {}
    fn skills_changed(&self, _agent: &AgentId) {}
    fn skill_library_changed(&self) {}
    fn delegation_changed(&self, _delegation: &Delegation) {}
}

impl AppControl for Silent {
    fn restart(&self) {}
}
