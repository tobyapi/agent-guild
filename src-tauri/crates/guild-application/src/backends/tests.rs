use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use guild_domain::backend::{
    ApiKeySpec, BackendInfo, BackendSetup, BackendStatus, InstallGuide, RuntimeStatus, StartSpec,
};
use parking_lot::Mutex;

use super::BackendService;
use crate::ports::{
    AgentRuntime, ImageRuntimeRequest, LaunchSettings, RuntimeError, RuntimeRequest, SettingsStore, UpdateSink,
};
use crate::AppResult;

#[derive(Default)]
struct Settings(Mutex<LaunchSettings>);
impl SettingsStore for Settings {
    fn load(&self) -> AppResult<LaunchSettings> {
        Ok(self.0.lock().clone())
    }
    fn save(&self, settings: &LaunchSettings) -> AppResult<()> {
        *self.0.lock() = settings.clone();
        Ok(())
    }
}

#[derive(Default)]
struct Runtime {
    calls: Mutex<Vec<(String, String, Option<String>)>>,
    probe_failure: bool,
    /// probe のたびに先頭から1つ進む、バックエンド一覧の移り変わり
    states: Mutex<VecDeque<Vec<BackendInfo>>>,
    started: AtomicBool,
    auth_modes: Mutex<Vec<(String, String)>>,
}

#[async_trait]
impl AgentRuntime for Runtime {
    fn status(&self) -> RuntimeStatus {
        panic!("unused")
    }
    fn backends(&self) -> Vec<BackendInfo> {
        self.states.lock().front().cloned().unwrap_or_default()
    }
    async fn run(&self, _: &str, _: RuntimeRequest, _: UpdateSink) -> Result<String, RuntimeError> {
        panic!("unused")
    }
    async fn generate_image(&self, _: &str, _: ImageRuntimeRequest, _: UpdateSink) -> Result<(), RuntimeError> {
        panic!("unused")
    }
    async fn cancel(&self, _: &str) {}
    async fn probe(&self) -> Result<(), RuntimeError> {
        if self.probe_failure {
            return Err(RuntimeError::Failed("バックエンドの再確認がタイムアウトしました".to_owned()));
        }
        let mut states = self.states.lock();
        if states.len() > 1 {
            states.pop_front();
        }
        Ok(())
    }
    async fn install_cli(&self, _: &InstallGuide) -> Result<(), RuntimeError> {
        panic!("unused")
    }
    async fn start(&self, _: &str, _: &StartSpec) -> Result<(), RuntimeError> {
        self.started.store(true, Ordering::Relaxed);
        Ok(())
    }
    async fn login(&self, _: &str) -> Result<(), RuntimeError> {
        panic!("unused")
    }
    async fn api_key(&self, backend: &str, action: &str, key: Option<&str>) -> Result<String, RuntimeError> {
        self.calls.lock().push((backend.to_owned(), action.to_owned(), key.map(str::to_owned)));
        if key == Some("fail-dummy") {
            return Err(RuntimeError::Failed("private-dummy-error".to_owned()));
        }
        Ok("{\"source\":\"saved\",\"supported\":true}".to_owned())
    }
    async fn set_backend_auth_mode(&self, backend: &str, mode: &str) -> Result<(), RuntimeError> {
        self.auth_modes.lock().push((backend.to_owned(), mode.to_owned()));
        Ok(())
    }
}

/// 契約の実例（contracts/ipc/snapshot.json）にあるバックエンドの申告
fn declared(id: &str) -> BackendInfo {
    let snapshot: guild_domain::snapshot::Snapshot =
        serde_json::from_str(include_str!("../../../../../contracts/ipc/snapshot.json")).unwrap();
    snapshot.backends.into_iter().find(|backend| backend.id == id).unwrap()
}

/// API キーを保存できると申告するバックエンド
fn keyed(id: &str) -> BackendInfo {
    let api_key = Some(ApiKeySpec { env_var: "EXAMPLE_API_KEY".to_owned() });
    BackendInfo { id: id.to_owned(), setup: BackendSetup { api_key, ..BackendSetup::default() }, ..declared("codex") }
}

fn service_with(backends: Vec<BackendInfo>) -> (Arc<Runtime>, BackendService) {
    let runtime = Arc::new(Runtime { states: Mutex::new(VecDeque::from([backends])), ..Runtime::default() });
    (runtime.clone(), BackendService::new(runtime, Arc::new(Settings::default())))
}

#[tokio::test]
async fn auth_mode_is_validated_persisted_and_applied_to_the_runtime() {
    let runtime = Arc::new(Runtime::default());
    let settings = Arc::new(Settings::default());
    let service = BackendService::new(runtime.clone(), settings.clone());
    assert!(service.set_auth_mode("grok", "api").await.is_err());
    assert!(service.set_auth_mode("claude", "invalid").await.is_err());
    service.set_auth_mode("claude", "api").await.unwrap();
    assert_eq!(settings.load().unwrap().backend_auth_modes.get("claude").map(String::as_str), Some("api"));
    assert_eq!(&*runtime.auth_modes.lock(), &[("claude".to_owned(), "api".to_owned())]);
}

#[tokio::test]
async fn validates_before_forwarding_to_the_runtime() {
    let (runtime, service) = service_with(vec![declared("claude"), keyed("grok"), keyed("muse")]);
    for (backend, action, key) in [
        ("claude", "set", Some("dummy")),
        ("unknown", "set", Some("dummy")),
        ("grok", "get", None),
        ("muse", "set", None),
        ("grok", "set", Some("  ")),
        ("muse", "set", Some("line\nbreak")),
    ] {
        assert!(service.api_key(backend, action, key).await.is_err());
    }
    assert!(runtime.calls.lock().is_empty());
    assert!(service.api_key("grok", "set", Some("dummy")).await.is_ok());
    assert!(service.api_key("muse", "delete", Some("discard-dummy")).await.is_ok());
    assert_eq!(runtime.calls.lock()[0], ("grok".to_owned(), "set".to_owned(), Some("dummy".to_owned())));
    assert_eq!(runtime.calls.lock()[1], ("muse".to_owned(), "delete".to_owned(), None));
}

#[tokio::test]
async fn redacts_runtime_failures() {
    let (_, service) = service_with(vec![keyed("grok")]);
    let error = service.api_key("grok", "set", Some("fail-dummy")).await.unwrap_err().to_string();
    assert!(!error.contains("private-dummy-error"));
    assert!(!error.contains("fail-dummy"));
}

#[tokio::test]
async fn refresh_returns_probe_failures_to_the_caller() {
    let service = BackendService::new(
        Arc::new(Runtime { probe_failure: true, ..Runtime::default() }),
        Arc::new(Settings::default()),
    );
    let error = service.refresh().await.unwrap_err();
    assert!(matches!(error, crate::error::AppError::Runtime(message) if message.contains("タイムアウト")));
}

#[tokio::test(start_paused = true)]
async fn start_opens_the_app_and_waits_for_the_model_list() {
    let ready = declared("ollama");
    let stopped = BackendInfo { status: BackendStatus::Stopped, models: Vec::new(), ..ready.clone() };
    let states = VecDeque::from([vec![stopped.clone()], vec![stopped], vec![ready]]);
    let runtime = Arc::new(Runtime { states: Mutex::new(states), ..Runtime::default() });
    let service = BackendService::new(runtime.clone(), Arc::new(Settings::default()));
    assert!(service.start("ollama").await.is_ok());
    assert!(runtime.started.load(Ordering::Relaxed));
    assert!(!runtime.backends()[0].models.is_empty());
}

#[tokio::test]
async fn setup_actions_are_limited_to_what_the_backend_declares() {
    let (runtime, service) = service_with(vec![declared("claude"), declared("ollama")]);
    let cannot_start = service.start("claude").await.unwrap_err().to_string();
    assert!(cannot_start.contains("アプリから起動できません"), "{cannot_start}");
    assert!(service.start("unknown").await.is_err());
    assert!(!runtime.started.load(Ordering::Relaxed));
    assert!(service.install_cli("ollama").await.is_err());
    assert!(service.install_cli("unknown").await.is_err());
    assert!(service.login("ollama").await.unwrap_err().to_string().contains("ログインできません"));
}
