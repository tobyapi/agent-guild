//! 1回の実行の流れ: ready の接続を得る → 待ち手を登録 → run（または login）を送る → 終端イベント・接続断・cancel を待つ。
//! cancel 後は終端イベントか cancel_grace の早いほうで `Cancelled` を返す（以後その id のイベントは捨てる）。

use std::sync::Arc;
use std::time::Duration;

use crate::connection::Connection;
use crate::jobs::Jobs;
use crate::shared::Shared;
use crate::wire::Request;
use crate::{RunRequest, RunnerError, RunnerStatus, UpdateFn};

/// 起動中の ready を待つとき、ready_timeout に足す余裕
const STARTING_MARGIN: Duration = Duration::from_secs(1);

/// ランナーに頼む仕事。どちらも終端イベント（result / error）をちょうど1回返す
#[derive(Clone, Copy)]
pub(crate) enum Work<'a> {
    Run(&'a RunRequest),
    ApiKey {
        backend: &'a str,
        action: &'a str,
        key: Option<&'a str>,
    },
    /// バックエンドのログイン（値はバックエンドの ID）
    Login(&'a str),
    Probe,
}

fn request<'a>(work: Work<'a>, id: &'a str) -> Request<'a> {
    match work {
        Work::ApiKey { backend, action, key } => Request::ApiKey { id, backend, action, key },
        Work::Run(request) => Request::Run { id, request },
        Work::Login(backend) => Request::Login { id, backend },
        Work::Probe => Request::Probe { id },
    }
}

pub(crate) async fn run(
    shared: &Shared,
    job_id: &str,
    work: Work<'_>,
    on_update: UpdateFn,
) -> Result<String, RunnerError> {
    let connection = ready_connection(shared).await?;
    let job = shared.jobs.register(job_id, on_update)?;
    let mut registration = Registration { jobs: &shared.jobs, id: job_id, sent_on: None };
    let (mut outcome, mut cancel) = (job.outcome, job.cancel);
    connection.send(&request(work, job_id)).await?;
    registration.sent_on = Some(Arc::clone(&connection));
    if cancel.is_requested() {
        // run を送る前に cancel された: ランナーには run の後に cancel が届くよう送り直す
        let _ = connection.send(&Request::Cancel { id: job_id }).await;
    }
    tokio::select! {
        biased;
        () = cancel.requested() => {}
        result = &mut outcome => return result.unwrap_or(Err(RunnerError::Disconnected)),
        () = connection.closed() => return Err(RunnerError::Disconnected),
    }
    // ランナー側の実行が止まった印（終端イベント）を猶予の間だけ待つ。届いた結果は使わない
    let stopped = async {
        tokio::select! {
            _ = &mut outcome => {}
            () = connection.closed() => {}
        }
    };
    let _ = tokio::time::timeout(shared.config.cancel_grace, stopped).await;
    Err(RunnerError::Cancelled)
}

/// ready の接続。起動中なら決着がつくまで待ち、使えなければその理由で `Unavailable`
async fn ready_connection(shared: &Shared) -> Result<Arc<Connection>, RunnerError> {
    let mut status = shared.status.subscribe();
    let wait = shared.config.ready_timeout + STARTING_MARGIN;
    let settled = tokio::time::timeout(wait, status.wait_for(|status| *status != RunnerStatus::Starting)).await;
    let status = match settled {
        Ok(Ok(status)) => (*status).clone(),
        Ok(Err(_)) => RunnerStatus::Unavailable { message: "ランナーは停止しています".to_owned() },
        Err(_) => {
            RunnerStatus::Unavailable { message: "ランナーの起動が終わりませんでした".to_owned() }
        }
    };
    match status {
        RunnerStatus::Ready => {
            shared.current().ok_or_else(|| RunnerError::Unavailable("ランナーとの接続が切れました".to_owned()))
        }
        RunnerStatus::Unavailable { message } => Err(RunnerError::Unavailable(message)),
        RunnerStatus::Starting => Err(RunnerError::Unavailable("ランナーを起動しています".to_owned())),
    }
}

/// 実行の間だけ待ち手を登録しておく。終端イベント以外で終わったら（接続断・猶予切れ・future の drop）ここで外し、
/// 実行中のまま future が捨てられたときはランナー側にも cancel を送る。
struct Registration<'a> {
    jobs: &'a Jobs,
    id: &'a str,
    sent_on: Option<Arc<Connection>>,
}

impl Drop for Registration<'_> {
    fn drop(&mut self) {
        let Some(cancel_requested) = self.jobs.remove(self.id) else {
            return;
        };
        if cancel_requested {
            return;
        }
        if let Some(connection) = self.sent_on.take().filter(|connection| connection.is_alive()) {
            connection.cancel_in_background(self.id);
        }
    }
}
