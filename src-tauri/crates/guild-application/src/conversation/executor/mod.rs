//! 1ジョブの実行。実行（プロンプト組み立て → ランタイム。別タスク）と、
//! 結果の確定（保存 → イベント → 振り分け。アクターの中で世代を確かめてから）の2段に分ける。
//! 作業の途中の投稿も、アクターの中で世代を確かめてから保存する（interim.rs）。

mod commit;
mod delegate;
mod ending;
mod history;
mod interim;
mod measurement;
mod notification;
mod request;
mod request_scope;
mod skill_records;

pub(crate) use commit::commit;
pub(crate) use ending::{Committed, Ending};
pub(crate) use interim::post_progress;

use std::sync::Arc;

use guild_domain::conversation::JobSpec;

use crate::ports::{RunUpdate, RuntimeError};
use crate::services::Ports;

/// 実行の結果（まだ保存していない）
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum RunOutcome {
    /// ランナーが返した文章（整形前）
    Reply(String, guild_domain::skill_usage::SkillUsage),
    /// 失敗（日本語のメッセージ）
    Failed(String),
    /// 中断された（失敗ではない）
    Cancelled,
    /// 始める前にエージェントやチャンネルがなくなっていた
    Skipped,
}

type UpdateFn = Arc<dyn Fn(RunUpdate) + Send + Sync>;
type FinishedFn = Box<dyn FnOnce(RunOutcome) + Send>;

/// 実行タスクからアクターへの報告。報告せずに捨てられた（パニックなど）ときも失敗として必ず1回報告する
pub(crate) struct JobReporter {
    update: UpdateFn,
    finished: Option<FinishedFn>,
}

impl JobReporter {
    pub fn new(
        update: impl Fn(RunUpdate) + Send + Sync + 'static,
        finished: impl FnOnce(RunOutcome) + Send + 'static,
    ) -> Self {
        Self { update: Arc::new(update), finished: Some(Box::new(finished)) }
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
            finished(RunOutcome::Failed(
                guild_domain::locale::pick([
                    "内部エラーで実行が止まりました",
                    "The run stopped because of an internal error.",
                    "因内部错误，执行已停止。",
                    "因內部錯誤，執行已停止。",
                    "내부 오류로 실행이 멈췄습니다.",
                ])
                .to_owned(),
            ));
        }
    }
}

/// 1ジョブを実行して結果を報告する（Spawner で別タスクとして動かす）
pub(crate) async fn run(
    ports: Ports,
    job_id: String,
    job: JobSpec,
    timeout_minutes: Option<u16>,
    reporter: JobReporter,
) {
    let outcome = execute(&ports, &job_id, &job, timeout_minutes, Arc::clone(&reporter.update)).await;
    reporter.finish(outcome);
}

async fn execute(
    ports: &Ports,
    job_id: &str,
    job: &JobSpec,
    timeout_minutes: Option<u16>,
    update: UpdateFn,
) -> RunOutcome {
    let request = match request::build(ports, job, timeout_minutes) {
        Ok(Some(request)) => request,
        Ok(None) => return RunOutcome::Skipped,
        Err(error) => return RunOutcome::Failed(error.to_string()),
    };
    let measurement = measurement::Measurement::new(job_id, &job.channel_id, &request);
    let agent_name = match ports.agents.get(&job.agent_id) {
        Ok(Some(agent)) => agent.name,
        Ok(None) => return RunOutcome::Skipped,
        Err(error) => return RunOutcome::Failed(error.to_string()),
    };
    let records = skill_records::SkillRecords::new(job_id, job.agent_id.as_str(), &agent_name);
    let sink = records.sink(measurement.sink(update));
    let result = ports.runtime.run(job_id, request, sink).await;
    let usage = records.finish();
    measurement.save(ports);
    match result {
        Ok(text) => RunOutcome::Reply(text, usage),
        Err(RuntimeError::Cancelled) => RunOutcome::Cancelled,
        Err(RuntimeError::Failed(message)) => RunOutcome::Failed(message),
    }
}
