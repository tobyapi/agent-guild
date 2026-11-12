//! AgentRuntime を runner-client（agent-runner sidecar）で実装する。runner_client はこのフォルダの中だけで使う。
//! ランナーの起動はアプリの起動を止めない: 生成は失敗せず、起動・再起動は runner-client の監視タスクが行う。
//! 状態（starting / ready / unavailable）やバックエンド一覧が変わったら state-changed を出す。

#[cfg(target_os = "macos")]
mod app_launcher;
#[cfg(target_os = "macos")]
mod cli_installer;
mod convert;
mod failure;
mod launch;
#[cfg(target_os = "macos")]
mod setup_text;
#[cfg(test)]
mod tests;
mod user_path;

use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use guild_application::ports::{AgentRuntime, EventPublisher, RuntimeError, RuntimeRequest, Spawner, UpdateSink};
use guild_domain::backend::{BackendInfo, InstallGuide, RuntimeStatus, StartSpec};
use guild_domain::locale::Language;
use runner_client::{RunnerClient, RunnerStatus};
use tokio::sync::watch;

pub struct RunnerRuntime {
    client: RunnerClient,
    /// ログインの要求に振る通し番号（ジョブの id にする）
    logins: AtomicU64,
}

impl RunnerRuntime {
    /// ランナーを起動する（同梱の runner がリソースにあればそれ、なければ開発用。launch.rs）。language は最初の言語。
    /// tokio ランタイムの文脈を用意してから runner-client を生成する
    pub fn start(
        events: Arc<dyn EventPublisher>,
        spawner: &dyn Spawner,
        resource_dir: Option<&Path>,
        language: Language,
    ) -> Arc<Self> {
        let handle = tauri::async_runtime::handle();
        let _context = handle.inner().enter();
        let client = RunnerClient::new(launch::runner_config(resource_dir, language));
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
        self.client.run(job_id, convert::request(request), on_update).await.map_err(failure::error)
    }

    async fn cancel(&self, job_id: &str) {
        self.client.cancel(job_id).await;
    }

    async fn probe(&self) -> Result<(), RuntimeError> {
        self.client.probe().await.map_err(failure::error)
    }

    #[cfg(target_os = "macos")]
    async fn install_cli(&self, guide: &InstallGuide) -> Result<(), RuntimeError> {
        cli_installer::install(guide).await
    }

    #[cfg(not(target_os = "macos"))]
    async fn install_cli(&self, _guide: &InstallGuide) -> Result<(), RuntimeError> {
        Err(RuntimeError::Failed(
            guild_domain::locale::pick([
                "この環境ではアプリからセットアップできません",
                "Setup from the app is not available in this environment",
                "此环境无法从应用中进行设置",
                "此環境無法從應用程式中進行設定",
                "이 환경에서는 앱에서 설정할 수 없습니다",
            ])
            .to_owned(),
        ))
    }

    #[cfg(target_os = "macos")]
    async fn start(&self, label: &str, spec: &StartSpec) -> Result<(), RuntimeError> {
        app_launcher::open(label, spec).await
    }

    #[cfg(not(target_os = "macos"))]
    async fn start(&self, label: &str, _spec: &StartSpec) -> Result<(), RuntimeError> {
        Err(RuntimeError::Failed(guild_domain::locale::pick([
            format!("この環境では {label} を直接起動できません。{label} を開いて再確認してください。"),
            format!("{label} can't be started directly in this environment. Open {label}, then recheck."),
            format!("此环境无法直接启动 {label}。请打开 {label} 后重新检查。"),
            format!("此環境無法直接啟動 {label}。請開啟 {label} 後重新檢查。"),
            format!("이 환경에서는 {label}을(를) 직접 시작할 수 없습니다. {label}을(를) 연 뒤 다시 확인하세요."),
        ])))
    }

    async fn api_key(&self, backend: &str, action: &str, key: Option<&str>) -> Result<String, RuntimeError> {
        let id = format!("api-key-{}", self.logins.fetch_add(1, Ordering::Relaxed) + 1);
        self.client.api_key(&id, backend, action, key).await.map_err(failure::error)
    }

    async fn set_language(&self, language: Language) {
        self.client.set_language(language.code()).await;
    }

    async fn login(&self, backend: &str) -> Result<(), RuntimeError> {
        let job_id = format!("login-{}", self.logins.fetch_add(1, Ordering::Relaxed) + 1);
        self.client.login(&job_id, backend).await.map_err(failure::error)
    }
}
