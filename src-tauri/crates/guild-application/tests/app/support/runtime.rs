//! 台本どおりに返すランタイム（agent-runner の代わり）。エージェントは作業場所のパスで見分ける。

use std::collections::{HashMap, VecDeque};
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use guild_application::ports::{ActivitySink, AgentRuntime, RuntimeError, RuntimeRequest};
use guild_domain::agent::Permissions;
use guild_domain::backend::{BackendInfo, BackendStatus, RuntimeState, RuntimeStatus};
use parking_lot::Mutex;
use tokio::sync::Notify;

/// 1回分の返し方
pub enum Script {
    Reply(String),
    Fail(String),
    /// 中断されるまで返さない
    Hang,
    /// gate が開くまで待ってから返す（中断されたら Cancelled）
    Gate(Arc<Notify>, String),
    /// 中断を無視して、gate が開いたら返す（中断が間に合わなかった実行）
    Stubborn(Arc<Notify>, String),
}

pub fn reply(text: &str) -> Script {
    Script::Reply(text.to_owned())
}

#[derive(Default)]
pub struct FakeRuntime {
    scripts: Mutex<HashMap<String, VecDeque<Script>>>,
    /// (ジョブ ID, エージェント ID, 依頼)
    pub requests: Mutex<Vec<(String, String, RuntimeRequest)>>,
    pub cancelled: Mutex<Vec<String>>,
    pub backends: Mutex<Vec<BackendInfo>>,
    pub probes: AtomicUsize,
    /// login を頼まれたバックエンド（頼まれた順）
    pub logins: Mutex<Vec<String>>,
    cancel_signal: Notify,
}

impl FakeRuntime {
    pub fn with_backend(id: &str) -> Self {
        let runtime = Self::default();
        runtime.backends.lock().push(ready_backend(id));
        runtime
    }

    /// そのエージェントの次の実行の返し方を足す
    pub fn script(&self, agent_id: &str, script: Script) {
        self.scripts.lock().entry(agent_id.to_owned()).or_default().push_back(script);
    }

    /// そのエージェントへの依頼（実行順）
    pub fn requests_for(&self, agent_id: &str) -> Vec<RuntimeRequest> {
        let requests = self.requests.lock();
        requests.iter().filter(|(_, agent, _)| agent == agent_id).map(|(_, _, r)| r.clone()).collect()
    }

    async fn wait_cancel(&self, job_id: &str) -> Result<String, RuntimeError> {
        loop {
            let signal = self.cancel_signal.notified();
            if self.cancelled.lock().iter().any(|id| id == job_id) {
                return Err(RuntimeError::Cancelled);
            }
            signal.await;
        }
    }
}

pub fn ready_backend(id: &str) -> BackendInfo {
    let all = Permissions {
        web_search: true,
        web_fetch: true,
        read_files: true,
        write_files: true,
        write_anywhere: true,
        run_commands: true,
        skills: true,
    };
    BackendInfo {
        id: id.to_owned(),
        label: id.to_owned(),
        model_suggestions: Vec::new(),
        default_model: String::new(),
        capabilities: all,
        status: BackendStatus::Ready,
        status_message: String::new(),
        options: Vec::new(),
        permission_rules: Vec::new(),
        can_login: true,
    }
}

/// FakeWorkspace の作業場所 /ws/<agent>/work からエージェント ID を取り出す
fn agent_of(workspace: &Path) -> String {
    let agent = workspace.parent().and_then(Path::file_name);
    agent.map(|name| name.to_string_lossy().into_owned()).unwrap_or_default()
}

#[async_trait]
impl AgentRuntime for FakeRuntime {
    fn status(&self) -> RuntimeStatus {
        RuntimeStatus { state: RuntimeState::Ready, message: String::new() }
    }

    fn backends(&self) -> Vec<BackendInfo> {
        self.backends.lock().clone()
    }

    async fn run(&self, job_id: &str, request: RuntimeRequest, on_activity: ActivitySink) -> Result<String, RuntimeError> {
        let agent = agent_of(&request.workspace);
        on_activity("Web検索: テスト".to_owned());
        let script = self.scripts.lock().get_mut(&agent).and_then(VecDeque::pop_front);
        self.requests.lock().push((job_id.to_owned(), agent, request));
        match script.unwrap_or_else(|| reply("[PASS]")) {
            Script::Reply(text) => Ok(text),
            Script::Fail(message) => Err(RuntimeError::Failed(message)),
            Script::Hang => self.wait_cancel(job_id).await,
            Script::Gate(gate, text) => tokio::select! {
                () = gate.notified() => Ok(text),
                cancelled = self.wait_cancel(job_id) => cancelled,
            },
            Script::Stubborn(gate, text) => {
                gate.notified().await;
                Ok(text)
            }
        }
    }

    async fn cancel(&self, job_id: &str) {
        self.cancelled.lock().push(job_id.to_owned());
        self.cancel_signal.notify_waiters();
    }

    async fn probe(&self) {
        self.probes.fetch_add(1, Ordering::SeqCst);
    }

    async fn login(&self, backend: &str) -> Result<(), RuntimeError> {
        self.logins.lock().push(backend.to_owned());
        Ok(())
    }
}
