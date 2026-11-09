//! job_id ごとの待ち手（途中経過のコールバック・結果の受け口・cancel の合図）。stdout の読み取りタスクがここへ配送する。

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::Mutex;
use tokio::sync::{oneshot, watch};

use crate::{ActivityFn, RunnerError};

pub(crate) type Outcome = Result<String, RunnerError>;

struct Waiter {
    on_activity: Arc<dyn Fn(String) + Send + Sync>,
    done: oneshot::Sender<Outcome>,
    cancel: watch::Sender<bool>,
}

/// 登録した側が持つ受け口
pub(crate) struct JobHandle {
    pub(crate) outcome: oneshot::Receiver<Outcome>,
    pub(crate) cancel: CancelSignal,
}

pub(crate) struct CancelSignal(watch::Receiver<bool>);

impl CancelSignal {
    pub(crate) fn is_requested(&self) -> bool {
        *self.0.borrow()
    }

    /// cancel されるまで待つ（cancel されないまま待ち手が外れたら、いつまでも完了しない）
    pub(crate) async fn requested(&mut self) {
        if self.0.wait_for(|requested| *requested).await.is_err() {
            std::future::pending::<()>().await;
        }
    }
}

#[derive(Default)]
pub(crate) struct Jobs {
    waiters: Mutex<HashMap<String, Waiter>>,
}

impl Jobs {
    /// 待ち手を登録する。同じ job_id が実行中ならエラー。
    pub(crate) fn register(&self, id: &str, on_activity: ActivityFn) -> Result<JobHandle, RunnerError> {
        let mut waiters = self.waiters.lock();
        if waiters.contains_key(id) {
            return Err(RunnerError::Protocol(format!("同じ job_id のジョブが実行中です: {id}")));
        }
        let (done, outcome) = oneshot::channel();
        let (cancel, cancel_signal) = watch::channel(false);
        let on_activity = Arc::from(on_activity);
        waiters.insert(id.to_owned(), Waiter { on_activity, done, cancel });
        Ok(JobHandle { outcome, cancel: CancelSignal(cancel_signal) })
    }

    /// 途中経過を渡す。cancel 後は流さない。コールバックはロックの外で呼ぶ（中から cancel などを呼んでも詰まらない）。
    pub(crate) fn activity(&self, id: &str, detail: String) {
        let on_activity = self
            .waiters
            .lock()
            .get(id)
            .filter(|waiter| !*waiter.cancel.borrow())
            .map(|waiter| Arc::clone(&waiter.on_activity));
        if let Some(on_activity) = on_activity {
            on_activity(detail);
        }
    }

    /// 終端イベントの結果を渡して待ち手を外す。待ち手がいなければ（猶予切れなど）false。
    pub(crate) fn finish(&self, id: &str, outcome: Outcome) -> bool {
        let Some(waiter) = self.waiters.lock().remove(id) else {
            return false;
        };
        // 受け手が先に諦めていても（future の drop）困らない
        let _ = waiter.done.send(outcome);
        true
    }

    /// cancel の合図を出す。待ち手がいなければ false。
    pub(crate) fn request_cancel(&self, id: &str) -> bool {
        let waiters = self.waiters.lock();
        let Some(waiter) = waiters.get(id) else {
            return false;
        };
        waiter.cancel.send_replace(true);
        true
    }

    /// 結果を渡さずに待ち手を外す。外したら Some(cancel 済みだったか)。
    pub(crate) fn remove(&self, id: &str) -> Option<bool> {
        self.waiters.lock().remove(id).map(|waiter| *waiter.cancel.borrow())
    }
}
