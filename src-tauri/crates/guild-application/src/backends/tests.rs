use std::sync::Arc;

use async_trait::async_trait;
use guild_domain::backend::{BackendInfo, RuntimeStatus};
use parking_lot::Mutex;

use super::BackendService;
use crate::ports::{AgentRuntime, RuntimeError, RuntimeRequest, UpdateSink};

#[derive(Default)]
struct Runtime {
    calls: Mutex<Vec<(String, String, Option<String>)>>,
    probe_failure: bool,
}

#[async_trait]
impl AgentRuntime for Runtime {
    fn status(&self) -> RuntimeStatus {
        panic!("unused")
    }
    fn backends(&self) -> Vec<BackendInfo> {
        Vec::new()
    }
    async fn run(&self, _: &str, _: RuntimeRequest, _: UpdateSink) -> Result<String, RuntimeError> {
        panic!("unused")
    }
    async fn cancel(&self, _: &str) {}
    async fn probe(&self) -> Result<(), RuntimeError> {
        if self.probe_failure {
            return Err(RuntimeError::Failed("バックエンドの再確認がタイムアウトしました".to_owned()));
        }
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
