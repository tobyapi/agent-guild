//! 台本どおりに返すランタイム（agent-runner の代わり）。エージェントは作業場所のパスで見分ける。

use std::collections::{HashMap, VecDeque};
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use guild_application::ports::{
    AgentRuntime, ImageRuntimeRequest, RunUpdate, RuntimeError, RuntimeRequest, UpdateSink,
};
use guild_domain::backend::{BackendInfo, InstallGuide, RuntimeState, RuntimeStatus, StartSpec};
use guild_domain::locale::Language;
use guild_domain::statistics::RunUsage;
use parking_lot::Mutex;
use tokio::sync::Notify;

pub use super::backends::ready_backend;
use super::frames::ImageScript;

/// 1回分の返し方
pub enum Script {
    Reply(String),
    Fail(String),
    Measured(Vec<RunUsage>, Result<String, RuntimeError>),
    /// 中断されるまで返さない
    Hang,
    /// gate が開くまで待ってから返す（中断されたら Cancelled）
    Gate(Arc<Notify>, String),
    /// 中断を無視して、gate が開いたら返す（中断が間に合わなかった実行）
    Stubborn(Arc<Notify>, String),
    /// 作業の途中の投稿を順に送ってから返す
    Posts(Vec<String>, String),
    /// 中断を無視して、gate が開いたら途中の投稿を送り、[PASS] を返す
    LatePost(Arc<Notify>, String),
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
    /// set_language で伝えられた言語（伝えられた順）
    pub languages: Mutex<Vec<Language>>,
    /// 画像の依頼の返し方（足した順に使う。なければ描けたことにする）と、届いた依頼
    pub image_scripts: Mutex<VecDeque<ImageScript>>,
    pub image_requests: Mutex<Vec<ImageRuntimeRequest>>,
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

/// FakeWorkspace の作業場所 /ws/<agent>/work からエージェント ID を取り出す
fn agent_of(workspace: &Path) -> String {
    let agent = workspace.ancestors().find(|path| path.parent() == Some(Path::new("/ws"))).and_then(Path::file_name);
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

    async fn run(&self, job_id: &str, request: RuntimeRequest, on_update: UpdateSink) -> Result<String, RuntimeError> {
        let agent = agent_of(&request.workspace);
        on_update(RunUpdate::Activity("Web検索: テスト".to_owned()));
        let script = self.scripts.lock().get_mut(&agent).and_then(VecDeque::pop_front);
        self.requests.lock().push((job_id.to_owned(), agent, request));
        match script.unwrap_or_else(|| reply("[PASS]")) {
            Script::Reply(text) => Ok(text),
            Script::Fail(message) => Err(RuntimeError::Failed(message)),
            Script::Measured(events, result) => {
                for event in events {
                    on_update(RunUpdate::Usage(event));
                }
                result
            }
            Script::Hang => self.wait_cancel(job_id).await,
            Script::Gate(gate, text) => tokio::select! {
                () = gate.notified() => Ok(text),
                cancelled = self.wait_cancel(job_id) => cancelled,
            },
            Script::Stubborn(gate, text) => {
                gate.notified().await;
                Ok(text)
            }
            Script::Posts(posts, text) => {
                for post in posts {
                    on_update(RunUpdate::Post(post));
                }
                Ok(text)
            }
            Script::LatePost(gate, post) => {
                gate.notified().await;
                on_update(RunUpdate::Post(post));
                Ok("[PASS]".to_owned())
            }
        }
    }

    async fn generate_image(
        &self,
        job_id: &str,
        request: ImageRuntimeRequest,
        on_update: UpdateSink,
    ) -> Result<(), RuntimeError> {
        on_update(RunUpdate::Activity("描いています".to_owned()));
        self.image_requests.lock().push(request);
        let script = self.image_scripts.lock().pop_front();
        match script.unwrap_or(ImageScript::Drawn) {
            ImageScript::Drawn => Ok(()),
            ImageScript::Fail(message) => Err(RuntimeError::Failed(message)),
            ImageScript::Hang => self.wait_cancel(job_id).await.map(|_| ()),
        }
    }

    async fn cancel(&self, job_id: &str) {
        self.cancelled.lock().push(job_id.to_owned());
        self.cancel_signal.notify_waiters();
    }

    async fn probe(&self) -> Result<(), RuntimeError> {
        self.probes.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }

    async fn install_cli(&self, _guide: &InstallGuide) -> Result<(), RuntimeError> {
        Ok(())
    }

    async fn start(&self, _label: &str, _spec: &StartSpec) -> Result<(), RuntimeError> {
        Ok(())
    }

    async fn login(&self, backend: &str) -> Result<(), RuntimeError> {
        self.logins.lock().push(backend.to_owned());
        Ok(())
    }

    async fn api_key(&self, _backend: &str, _action: &str, _key: Option<&str>) -> Result<String, RuntimeError> {
        Ok(String::new())
    }

    async fn set_language(&self, language: Language) {
        self.languages.lock().push(language);
    }
}
