//! 1ジョブの実行。実行（プロンプト組み立て → ランタイム。別タスク）と、
//! 結果の確定（保存 → イベント → 振り分け。アクターの中で世代を確かめてから）の2段に分ける。

mod commit;
mod delegate;
mod ending;
mod request;

pub(crate) use commit::commit;
pub(crate) use ending::{Committed, Ending};

use std::sync::Arc;

use guild_domain::conversation::JobSpec;

use super::JOB_TIMEOUT;
use crate::ports::RuntimeError;
use crate::services::Ports;

/// 実行の結果（まだ保存していない）
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum RunOutcome {
    /// ランナーが返した文章（整形前）
    Reply(String),
    /// 失敗（日本語のメッセージ）
    Failed(String),
    TimedOut,
    /// 中断された（失敗ではない）
    Cancelled,
    /// 始める前にエージェントやチャンネルがなくなっていた
    Skipped,
}

type ActivityFn = Arc<dyn Fn(String) + Send + Sync>;
type FinishedFn = Box<dyn FnOnce(RunOutcome) + Send>;

/// 実行タスクからアクターへの報告。報告せずに捨てられた（パニックなど）ときも失敗として必ず1回報告する
pub(crate) struct JobReporter {
    activity: ActivityFn,
    finished: Option<FinishedFn>,
}

impl JobReporter {
    pub fn new(
        activity: impl Fn(String) + Send + Sync + 'static,
        finished: impl FnOnce(RunOutcome) + Send + 'static,
    ) -> Self {
        Self {
            activity: Arc::new(activity),
            finished: Some(Box::new(finished)),
        }
    }

    fn finish(mut self, outcome: RunOutcome) {
        if let Some(finished) = self.finished.take() {
            finished(outcome);
        }
    }
}

impl Drop for JobReporter {
    fn drop(&mut self) {
        if let Some(finished) = self.finished.take() {
            finished(RunOutcome::Failed("内部エラーで実行が止まりました".to_owned()));
        }
    }
}

/// 1ジョブを実行して結果を報告する（Spawner で別タスクとして動かす）
pub(crate) async fn run(ports: Ports, job_id: String, job: JobSpec, reporter: JobReporter) {
    let outcome = execute(&ports, &job_id, &job, Arc::clone(&reporter.activity)).await;
    reporter.finish(outcome);
}

async fn execute(ports: &Ports, job_id: &str, job: &JobSpec, activity: ActivityFn) -> RunOutcome {
    let request = match request::build(ports, job) {
        Ok(Some(request)) => request,
        Ok(None) => return RunOutcome::Skipped,
        Err(error) => return RunOutcome::Failed(error.to_string()),
    };
    let sink = Box::new(move |detail: String| activity(detail));
    match tokio::time::timeout(JOB_TIMEOUT, ports.runtime.run(job_id, request, sink)).await {
        Ok(Ok(text)) => RunOutcome::Reply(text),
        Ok(Err(RuntimeError::Cancelled)) => RunOutcome::Cancelled,
        Ok(Err(RuntimeError::Failed(message))) => RunOutcome::Failed(message),
        Err(_) => {
            ports.runtime.cancel(job_id).await;
            RunOutcome::TimedOut
        }
    }
}
