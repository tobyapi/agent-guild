//! RunnerClient・監視タスク・読み取りタスクが共有する状態。

use std::collections::BTreeMap;
use std::sync::Arc;

use parking_lot::Mutex;
use tokio::sync::watch;

use crate::connection::Connection;
use crate::job_object::KillOnCloseJob;
use crate::jobs::Jobs;
use crate::{BackendInfo, RunnerConfig, RunnerStatus};

pub(crate) struct Shared {
    pub(crate) config: RunnerConfig,
    pub(crate) jobs: Jobs,
    pub(crate) status: watch::Sender<RunnerStatus>,
    pub(crate) backends: watch::Sender<Vec<BackendInfo>>,
    /// shutdown が要求された・RunnerClient が捨てられた（監視タスクは再起動をやめる）
    pub(crate) closing: watch::Sender<bool>,
    /// 起動したランナーを入れるジョブオブジェクト（作れなかったら None。孤児対策が効かないだけで動作は続ける）
    pub(crate) job_object: Option<KillOnCloseJob>,
    /// ready になった接続（ready でなければ None）
    current: Mutex<Option<Arc<Connection>>>,
    /// いまの言語のコード（起動のたびに読む。set_language で変わる）
    language: Mutex<String>,
    backend_auth_modes: Mutex<BTreeMap<String, String>>,
}

impl Shared {
    pub(crate) fn new(config: RunnerConfig, backend_auth_modes: BTreeMap<String, String>) -> Self {
        let job_object = KillOnCloseJob::new()
            .inspect_err(|error| log::warn!("ジョブオブジェクトを作れませんでした（孤児プロセス対策なし）: {error}"))
            .ok();
        Self {
            jobs: Jobs::default(),
            status: watch::Sender::new(crate::RunnerStatus::Starting),
            backends: watch::Sender::new(Vec::new()),
            closing: watch::Sender::new(false),
            job_object,
            current: Mutex::new(None),
            language: Mutex::new(config.language.clone()),
            backend_auth_modes: Mutex::new(backend_auth_modes),
            config,
        }
    }

    pub(crate) fn is_closing(&self) -> bool {
        *self.closing.borrow()
    }

    pub(crate) fn current(&self) -> Option<Arc<Connection>> {
        self.current.lock().clone()
    }

    pub(crate) fn set_current(&self, connection: Arc<Connection>) {
        *self.current.lock() = Some(connection);
    }

    /// まだその接続が現在のものなら外す（shutdown が先に外していれば何もしない）
    pub(crate) fn clear_current(&self, connection: &Arc<Connection>) {
        let mut current = self.current.lock();
        if current.as_ref().is_some_and(|active| Arc::ptr_eq(active, connection)) {
            *current = None;
        }
    }

    pub(crate) fn take_current(&self) -> Option<Arc<Connection>> {
        self.current.lock().take()
    }

    pub(crate) fn language(&self) -> String {
        self.language.lock().clone()
    }

    pub(crate) fn set_language(&self, language: &str) {
        *self.language.lock() = language.to_owned();
    }

    pub(crate) fn backend_auth_modes(&self) -> BTreeMap<String, String> {
        self.backend_auth_modes.lock().clone()
    }
    pub(crate) fn set_backend_auth_mode(&self, backend: &str, mode: &str) {
        self.backend_auth_modes.lock().insert(backend.to_owned(), mode.to_owned());
    }

    /// いまの言語の文言を選ぶ（日本語・英語・簡体字・繁体字・韓国語の順）
    pub(crate) fn pick<T>(&self, texts: [T; 5]) -> T {
        crate::text::pick(&self.language.lock(), texts)
    }
}
