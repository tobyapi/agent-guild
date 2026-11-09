//! 公開 API の `RunnerClient`。状態は監視タスク（supervisor）と共有し、1回の実行の流れは run.rs に任せる。

use std::sync::Arc;

use tokio::sync::watch;

use crate::shared::Shared;
use crate::wire::Request;
use crate::{run, supervisor, ActivityFn, BackendInfo, RunRequest, RunnerConfig, RunnerError, RunnerStatus};

/// ランナーとの接続。`Send + Sync` で、`Arc` に包んで複数タスクから同時に使ってよい。
pub struct RunnerClient {
    shared: Arc<Shared>,
}

impl RunnerClient {
    /// 失敗しない。tokio ランタイムの文脈で呼ぶこと（監視タスクを spawn し、起動・再起動はそのタスクが行う）。
    pub fn new(config: RunnerConfig) -> Self {
        let shared = Arc::new(Shared::new(config));
        tokio::spawn(supervisor::supervise(Arc::clone(&shared)));
        Self { shared }
    }

    pub fn status(&self) -> RunnerStatus {
        self.shared.status.borrow().clone()
    }

    pub fn watch_status(&self) -> watch::Receiver<RunnerStatus> {
        self.shared.status.subscribe()
    }

    /// `ready`（と `backends` イベント）で申告されたバックエンド一覧。ready でなければ空
    pub fn backends(&self) -> Vec<BackendInfo> {
        self.shared.backends.borrow().clone()
    }

    pub fn watch_backends(&self) -> watch::Receiver<Vec<BackendInfo>> {
        self.shared.backends.subscribe()
    }

    /// 1回実行して最終テキストを返す。起動中なら ready になるまで（最長 ready_timeout）待ち、使えなければ
    /// `Err(Unavailable)`。`cancel(job_id)` されたら、終端イベントか cancel_grace の早いほうで `Err(Cancelled)`。
    pub async fn run(&self, job_id: &str, request: RunRequest, on_activity: ActivityFn) -> Result<String, RunnerError> {
        run::run(&self.shared, job_id, run::Work::Run(&request), on_activity).await
    }

    /// バックエンドのログインを始め、利用者が終える（窓が閉じる）まで待つ。終わるとランナーが状態を確かめ直す
    /// （`watch_backends` に届く）。`cancel(job_id)` で打ち切れる
    pub async fn login(&self, job_id: &str, backend: &str) -> Result<(), RunnerError> {
        run::run(&self.shared, job_id, run::Work::Login(backend), Box::new(|_| {})).await.map(|_| ())
    }

    /// 実行中のジョブを中断する（存在しなければ何もしない）。待たずに戻る
    pub async fn cancel(&self, job_id: &str) {
        if !self.shared.jobs.request_cancel(job_id) {
            return;
        }
        if let Some(connection) = self.shared.current() {
            let _ = connection.send(&Request::Cancel { id: job_id }).await;
        }
    }

    /// バックエンドの状態（認証など）を確認し直させる。結果は `watch_backends` に届く
    pub async fn probe(&self) {
        if let Some(connection) = self.shared.current() {
            let _ = connection.send(&Request::Probe).await;
        }
    }

    /// `shutdown` を送って子プロセスを終了させ（猶予を過ぎたら kill）、以後は再起動しない
    pub async fn shutdown(&self) {
        supervisor::shutdown(&self.shared).await;
    }
}

impl Drop for RunnerClient {
    /// shutdown せずに捨てられたら監視タスクを止める。共有状態が消えると接続が捨てられ、子プロセスは kill される
    fn drop(&mut self) {
        self.shared.closing.send_replace(true);
    }
}
