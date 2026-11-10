//! AgentRuntime を runner-client（agent-runner sidecar）で実装する。runner_client はこのフォルダの中だけで使う。
//! ランナーの起動はアプリの起動を止めない: 生成は失敗せず、起動・再起動は runner-client の監視タスクが行う。
//! 状態（starting / ready / unavailable）やバックエンド一覧が変わったら state-changed を出す。

#[cfg(target_os = "macos")]
mod cli_installer;
mod convert;
mod launch;
#[cfg(target_os = "macos")]
mod ollama_launcher;
#[cfg(test)]
mod tests;
mod user_path;

use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use guild_application::ports::{AgentRuntime, EventPublisher, RuntimeError, RuntimeRequest, Spawner, UpdateSink};
use guild_domain::backend::{BackendInfo, RuntimeStatus};
use runner_client::{RunnerClient, RunnerStatus};
use tokio::sync::watch;

pub struct RunnerRuntime {
    client: RunnerClient,
    /// ログインの要求に振る通し番号（ジョブの id にする）
    logins: AtomicU64,
}

impl RunnerRuntime {
    /// ランナーを起動する（同梱の runner がリソースにあればそれ、なければ開発用。launch.rs）。
    /// tokio ランタイムの文脈を用意してから runner-client を生成する
    pub fn start(events: Arc<dyn EventPublisher>, spawner: &dyn Spawner, resource_dir: Option<&Path>) -> Arc<Self> {
        let handle = tauri::async_runtime::handle();
        let _context = handle.inner().enter();
        let client = RunnerClient::new(launch::runner_config(resource_dir));
        let watcher = notify_changes(client.watch_status(), client.watch_backends(), events);
        spawner.spawn(Box::pin(watcher));
        Arc::new(Self { client, logins: AtomicU64::new(0) })
    }

    /// shutdown を送って子プロセスを終了させる（アプリの終了時）
    pub async fn shutdown(&self) {
        self.client.shutdown().await;
    }
}

/// ランナーの状態かバックエンド一覧が変わるたびに state-changed を出す
async fn notify_changes(
    mut status: watch::Receiver<RunnerStatus>,
    mut backends: watch::Receiver<Vec<runner_client::BackendInfo>>,
    events: Arc<dyn EventPublisher>,
) {
    loop {
        let changed = tokio::select! {
            result = status.changed() => result,
            result = backends.changed() => result,
        };
        if changed.is_err() {
            break;
        }
        events.state_changed();
    }
}

#[async_trait]
impl AgentRuntime for RunnerRuntime {
    fn status(&self) -> RuntimeStatus {
        convert::status(self.client.status())
    }

    fn backends(&self) -> Vec<BackendInfo> {
        self.client.backends().into_iter().map(convert::backend).collect()
    }

    async fn run(&self, job_id: &str, request: RuntimeRequest, on_update: UpdateSink) -> Result<String, RuntimeError> {
        let on_update: runner_client::UpdateFn = Box::new(move |update| on_update(convert::update(update)));
        self.client.run(job_id, convert::request(request), on_update).await.map_err(convert::error)
    }

    async fn cancel(&self, job_id: &str) {
        self.client.cancel(job_id).await;
    }

    async fn probe(&self) -> Result<(), RuntimeError> {
        self.client.probe().await.map_err(convert::error)
    }

    #[cfg(target_os = "macos")]
    async fn install_cli(&self, backend: &str) -> Result<(), RuntimeError> {
        cli_installer::install(backend).await
    }

    #[cfg(target_os = "macos")]
    async fn open_ollama(&self) -> Result<(), RuntimeError> {
        ollama_launcher::open().await
    }

    async fn api_key(&self, backend: &str, action: &str, key: Option<&str>) -> Result<String, RuntimeError> {
        let id = format!("api-key-{}", self.logins.fetch_add(1, Ordering::Relaxed) + 1);
        self.client.api_key(&id, backend, action, key).await.map_err(convert::error)
    }

    async fn login(&self, backend: &str) -> Result<(), RuntimeError> {
        let job_id = format!("login-{}", self.logins.fetch_add(1, Ordering::Relaxed) + 1);
        self.client.login(&job_id, backend).await.map_err(convert::error)
    }
}
