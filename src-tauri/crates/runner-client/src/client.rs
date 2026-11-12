//! 公開 API の `RunnerClient`。状態は監視タスク（supervisor）と共有し、1回の実行の流れは run.rs に任せる。

use std::sync::Arc;

use tokio::sync::watch;

use crate::shared::Shared;
use crate::wire::Request;
use crate::{
    run, supervisor, BackendInfo, ImageRequest, RunRequest, RunnerConfig, RunnerError, RunnerStatus, UpdateFn,
};

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

    /// 1回実行して最終テキストを返す。途中経過と途中の投稿は `on_update` に届く。起動中なら ready になるまで
    /// （最長 ready_timeout）待ち、使えなければ `Err(Unavailable)`。`cancel(job_id)` されたら、終端イベントか
    /// cancel_grace の早いほうで `Err(Cancelled)`。
    pub async fn run(&self, job_id: &str, request: RunRequest, on_update: UpdateFn) -> Result<String, RunnerError> {
        run::run(&self.shared, job_id, run::Work::Run(&request), on_update).await
    }

    /// 画像を1枚描いてもらう（枠の生成を申告したバックエンドだけ）。成功したら PNG は `request.output` にある。
    /// 途中経過は `on_update` に届く。待ち方と `cancel(job_id)` の扱いは `run` と同じ
    pub async fn generate_image(
        &self,
        job_id: &str,
        request: ImageRequest,
        on_update: UpdateFn,
    ) -> Result<(), RunnerError> {
        run::run(&self.shared, job_id, run::Work::Image(&request), on_update).await.map(|_| ())
    }

    /// バックエンドのログインを始め、利用者が終える（窓が閉じる）まで待つ。終わるとランナーが状態を確かめ直す
    /// （`watch_backends` に届く）。`cancel(job_id)` で打ち切れる
    pub async fn login(&self, job_id: &str, backend: &str) -> Result<(), RunnerError> {
        run::run(&self.shared, job_id, run::Work::Login(backend), Box::new(|_| {})).await.map(|_| ())
    }

    /// 実行中のジョブを中断する（存在しなければ何もしない）。待たずに戻る
    pub async fn api_key(
        &self,
        id: &str,
        backend: &str,
        action: &str,
        key: Option<&str>,
    ) -> Result<String, RunnerError> {
        run::run(&self.shared, id, run::Work::ApiKey { backend, action, key }, Box::new(|_| {})).await
    }

    /// 言語（"ja"・"en"・"zh-Hans"・"zh-Hant"・"ko"）を変える。以後の起動の環境変数とこのクレートの文面に使い、
    /// ready のランナーには setLanguage を送る（ready でなければ、次の起動の環境変数か ready のあとの送信で伝わる）
    pub async fn set_language(&self, language: &str) {
        self.shared.set_language(language);
        if let Some(connection) = self.shared.current() {
            let _ = connection.send(&Request::SetLanguage { language }).await;
        }
    }

    pub async fn cancel(&self, job_id: &str) {
        if !self.shared.jobs.request_cancel(job_id) {
            return;
        }
        if let Some(connection) = self.shared.current() {
            let _ = connection.send(&Request::Cancel { id: job_id }).await;
        }
    }

    /// バックエンドの状態を確認し直し、結果を待つ。送信失敗・切断・30秒の応答待ち超過はエラー。
    pub async fn probe(&self) -> Result<(), RunnerError> {
        static NEXT_PROBE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
        let id = format!("runner-probe-{}", NEXT_PROBE.fetch_add(1, std::sync::atomic::Ordering::Relaxed));
        let refresh = run::run(&self.shared, &id, run::Work::Probe, Box::new(|_| {}));
        tokio::time::timeout(std::time::Duration::from_secs(30), refresh)
            .await
            .map_err(|_| RunnerError::Unavailable(self.probe_timed_out()))?
            .map(|_| ())
    }

    fn probe_timed_out(&self) -> String {
        let texts = [
            "バックエンドの再確認がタイムアウトしました",
            "Timed out rechecking the backends",
            "重新检查后端超时",
            "重新檢查後端逾時",
            "백엔드를 다시 확인하다 시간이 초과되었습니다",
        ];
        self.shared.pick(texts).to_owned()
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
