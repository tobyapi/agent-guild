use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use guild_domain::backend::{BackendInfo, BackendStatus, RuntimeStatus};
use parking_lot::Mutex;

use super::BackendService;
use crate::ports::{AgentRuntime, RuntimeError, RuntimeRequest, UpdateSink};

#[derive(Default)]
struct Runtime {
    calls: Mutex<Vec<(String, String, Option<String>)>>,
    probe_failure: bool,
    ollama_states: Mutex<VecDeque<BackendInfo>>,
    ollama_opened: AtomicBool,
}

#[async_trait]
impl AgentRuntime for Runtime {
    fn status(&self) -> RuntimeStatus {
        panic!("unused")
    }
    fn backends(&self) -> Vec<BackendInfo> {
        self.ollama_states.lock().front().cloned().into_iter().collect()
    }
    async fn run(&self, _: &str, _: RuntimeRequest, _: UpdateSink) -> Result<String, RuntimeError> {
        panic!("unused")
    }
    async fn cancel(&self, _: &str) {}
    async fn probe(&self) -> Result<(), RuntimeError> {
        if self.probe_failure {
            return Err(RuntimeError::Failed("バックエンドの再確認がタイムアウトしました".to_owned()));
        }
        let mut states = self.ollama_states.lock();
        if states.len() > 1 {
            states.pop_front();
        }
        Ok(())
    }
    async fn open_ollama(&self) -> Result<(), RuntimeError> {
        self.ollama_opened.store(true, Ordering::Relaxed);
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
}

#[tokio::test]
async fn validates_before_forwarding_to_the_runtime() {
    let runtime = Arc::new(Runtime::default());
    let service = BackendService::new(runtime.clone());
    for (backend, action, key) in [
        ("claude", "set", Some("dummy")),
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
    let service = BackendService::new(Arc::new(Runtime::default()));
    let error = service.api_key("grok", "set", Some("fail-dummy")).await.unwrap_err().to_string();
    assert!(!error.contains("private-dummy-error"));
    assert!(!error.contains("fail-dummy"));
}

#[tokio::test]
async fn refresh_returns_probe_failures_to_the_caller() {
    let service = BackendService::new(Arc::new(Runtime { probe_failure: true, ..Runtime::default() }));
    let error = service.refresh().await.unwrap_err();
    assert!(matches!(error, crate::error::AppError::Runtime(message) if message.contains("タイムアウト")));
}

#[tokio::test(start_paused = true)]
async fn start_ollama_waits_for_the_model_list_after_opening() {
    let snapshot: guild_domain::snapshot::Snapshot =
        serde_json::from_str(include_str!("../../../../../contracts/ipc/snapshot.json")).unwrap();
    let ready = snapshot.backends.into_iter().find(|backend| backend.id == "ollama").unwrap();
    let stopped = BackendInfo { status: BackendStatus::Stopped, models: Vec::new(), ..ready.clone() };
    let runtime = Arc::new(Runtime {
        ollama_states: Mutex::new(VecDeque::from([stopped.clone(), stopped, ready])),
        ..Runtime::default()
    });
    let service = BackendService::new(runtime.clone());
    assert!(service.start_ollama().await.is_ok());
    assert!(runtime.ollama_opened.load(Ordering::Relaxed));
    assert!(!runtime.backends()[0].models.is_empty());
}
