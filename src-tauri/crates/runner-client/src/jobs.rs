//! job_id ごとの待ち手（途中経過と途中の投稿のコールバック・結果の受け口・cancel の合図）。stdout の読み取りタスクがここへ配送する。

use std::collections::{HashMap, VecDeque};
use std::sync::Arc;

use parking_lot::Mutex;
use tokio::sync::{oneshot, watch};

use crate::{RunUpdate, RunnerError, UpdateFn};

pub(crate) type Outcome = Result<String, RunnerError>;

const MAX_EARLY_CANCELS: usize = 64;

struct Waiter {
    on_update: Arc<dyn Fn(RunUpdate) + Send + Sync>,
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
    state: Mutex<JobState>,
}

#[derive(Default)]
struct JobState {
    waiters: HashMap<String, Waiter>,
    early_cancels: VecDeque<String>,
}

impl Jobs {
    /// 待ち手を登録する。実行中の ID と、停止要求を引き継ぐ会話の実行はここで弾く。
    pub(crate) fn register(
        &self,
        id: &str,
        on_update: UpdateFn,
        honor_early_cancel: bool,
    ) -> Result<JobHandle, RunnerError> {
        let mut state = self.state.lock();
        if state.waiters.contains_key(id) {
            return Err(RunnerError::Protocol(format!("同じ job_id のジョブが実行中です: {id}")));
        }
        if let Some(index) = state.early_cancels.iter().position(|pending| pending == id) {
            state.early_cancels.remove(index);
            if honor_early_cancel {
                return Err(RunnerError::Cancelled);
            }
        }
        let (done, outcome) = oneshot::channel();
        let (cancel, cancel_signal) = watch::channel(false);
        let on_update = Arc::from(on_update);
        state.waiters.insert(id.to_owned(), Waiter { on_update, done, cancel });
        Ok(JobHandle { outcome, cancel: CancelSignal(cancel_signal) })
    }

    /// 途中経過・途中の投稿を渡す。cancel 後は流さない。コールバックはロックの外で呼ぶ（中から cancel などを呼んでも詰まらない）。
    pub(crate) fn update(&self, id: &str, update: RunUpdate) {
        let on_update = self
            .state
            .lock()
            .waiters
            .get(id)
            .filter(|waiter| !*waiter.cancel.borrow())
            .map(|waiter| Arc::clone(&waiter.on_update));
        if let Some(on_update) = on_update {
            on_update(update);
        }
    }

    /// 終端イベントの結果を渡して待ち手を外す。待ち手がいなければ（猶予切れなど）false。
    pub(crate) fn finish(&self, id: &str, outcome: Outcome) -> bool {
        let Some(waiter) = self.state.lock().waiters.remove(id) else {
            return false;
        };
        // 受け手が先に諦めていても（future の drop）困らない
        let _ = waiter.done.send(outcome);
        true
    }

    pub(crate) fn is_active(&self, id: &str) -> bool {
        self.state.lock().waiters.get(id).is_some_and(|waiter| !*waiter.cancel.borrow())
    }

    /// cancel の合図を出す。未登録なら記録して false を返す。
    pub(crate) fn request_cancel(&self, id: &str) -> bool {
        let mut state = self.state.lock();
        let Some(waiter) = state.waiters.get(id) else {
            state.early_cancels.retain(|pending| pending != id);
            if state.early_cancels.len() == MAX_EARLY_CANCELS {
                state.early_cancels.pop_front();
            }
            state.early_cancels.push_back(id.to_owned());
            return false;
        };
        waiter.cancel.send_replace(true);
        true
    }

    /// 結果を渡さずに待ち手を外す。外したら Some(cancel 済みだったか)。
    pub(crate) fn remove(&self, id: &str) -> Option<bool> {
        self.state.lock().waiters.remove(id).map(|waiter| *waiter.cancel.borrow())
    }
}
