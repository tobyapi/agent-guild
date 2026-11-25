//! アクター本体: コマンドを1つずつ処理し、そのたびに割り振りを見直し、始められるジョブを始めて、
//! 実行状況が変わったら知らせる。

use std::sync::Arc;

use guild_domain::activity::{thinking, ActivityState};
use guild_domain::conversation::JobSpec;
use guild_domain::locale;
use guild_domain::run_limits::RunLimits;
use tokio::sync::{mpsc, watch};

use super::approvals::Approvals;
use super::state::{DispatchState, Pending, Running};
use super::stopping::StopWaiter;
use super::Command;
use crate::conversation::activity;
use crate::conversation::executor::{self, Committed, Ending, RunOutcome};
use crate::conversation::posting::{self, Origin};
use crate::ports::SettingsStore;
use crate::services::Ports;

pub(super) struct Actor {
    pub(super) ports: Ports,
    pub(super) sender: mpsc::UnboundedSender<Command>,
    activity_tx: watch::Sender<ActivityState>,
    settings: Arc<dyn SettingsStore>,
    limits: RunLimits,
    pub(super) state: DispatchState,
    pub(super) approvals: Approvals,
    pub(super) waiters: Vec<StopWaiter>,
    /// 最後に保存した、待機・実行中のジョブの要約（inflight.rs）
    pub(super) recorded: Vec<crate::ports::InterruptedJob>,
}

impl Actor {
    pub fn new(
        ports: Ports,
        settings: Arc<dyn SettingsStore>,
        sender: mpsc::UnboundedSender<Command>,
        activity_tx: watch::Sender<ActivityState>,
    ) -> Self {
        let recorded = Vec::new();
        let limits = settings.load().map(|saved| saved.run_limits).unwrap_or_else(|error| {
            log::warn!("実行上限の設定を読み込めませんでした: {error}");
            RunLimits::default()
        });
        Self {
            ports,
            sender,
            activity_tx,
            settings,
            limits,
            state: DispatchState::default(),
            approvals: Approvals::default(),
            waiters: Vec::new(),
            recorded,
        }
    }

    pub async fn run(mut self, mut receiver: mpsc::UnboundedReceiver<Command>) {
        while let Some(command) = receiver.recv().await {
            self.handle(command);
            self.reconcile_delegations();
            self.pump();
            self.publish_activity();
            self.record_inflight();
        }
    }

    fn handle(&mut self, command: Command) {
        match command {
            Command::Dispatch { routing, origin } => self.apply(routing, &origin),
            Command::Enqueue(jobs) => {
                for job in jobs {
                    self.accept(job);
                }
            }
            Command::GetRunLimits { reply } => {
                let _ = reply.send(self.limits);
            }
            Command::SetRunLimits { limits, reply } => {
                let result = self.settings.update(Box::new(|settings| settings.run_limits = limits));
                if result.is_ok() {
                    self.limits = limits;
                }
                let _ = reply.send(result);
            }
            Command::EnqueueAutonomous { job, reply } => {
                let accepted = !self.state.has_work_for(&job.agent_id);
                if accepted {
                    self.accept(job);
                }
                let _ = reply.send(accepted);
            }
            Command::Activity { job_id, detail } => {
                if let Some(running) = self.state.running.get_mut(&job_id) {
                    running.detail = detail;
                }
            }
            Command::Post { job_id, text, skills } => self.post_progress(&job_id, &text, skills),
            Command::ApprovalRequested { job_id, request } => self.request_approval(&job_id, request),
            Command::ApprovalResolved { job_id, id, status } => self.resolve_approval(&job_id, &id, status),
            Command::ListApprovals { channel, reply } => self.list_approvals(&channel, reply),
            Command::DecideApproval { channel, id, decision, reply } => {
                self.decide_approval(&channel, id, decision, reply)
            }
            Command::ApprovalSendFailed { run_id, id } => self.approval_send_failed(&run_id, &id),
            Command::Finished { job_id, outcome } => self.finish(&job_id, outcome),
            Command::Stop { channel, announce, done } => self.stop(channel, announce, done),
            Command::StopAll { done } => self.stop_all(done),
            Command::RemoveAgent { agent, channel, done } => {
                self.remove_agent(&agent, channel.as_ref());
                let _ = done.send(());
            }
        }
    }

    /// 全体の上限まで、始められるジョブを始める（選び方は pick.rs）
    fn pump(&mut self) {
        while self.limits.max_concurrent_jobs.is_none_or(|limit| self.state.running.len() < usize::from(limit)) {
            let Some(pick) = self.state.next_startable() else {
                break;
            };
            let Some((pending, generation)) = self.state.take(pick) else {
                break;
            };
            self.start(pending, generation);
        }
    }

    fn start(&mut self, pending: Pending, generation: u64) {
        let job_id = self.ports.ids.new_id();
        let reporter = self.reporter(&job_id);
        let running = Running {
            ticket: pending.ticket,
            job: pending.job.clone(),
            generation,
            discarded: false,
            detail: thinking(locale::current()).to_owned(),
        };
        self.state.running.insert(job_id.clone(), running);
        self.subtask_started(&pending.job);
        let task = executor::run(self.ports.clone(), job_id, pending.job, self.limits.timeout_minutes, reporter);
        self.ports.spawner.spawn(Box::pin(task));
    }

    /// 実行が終わった: 世代が変わらず取り消されてもいなければ、結果を保存して振り分ける
    fn finish(&mut self, job_id: &str, outcome: RunOutcome) {
        self.cancel_approvals(job_id);
        let Some(running) = self.state.running.remove(job_id) else {
            return;
        };
        if self.state.is_current(&running) {
            match executor::commit(&self.ports, &running.job, outcome) {
                Ok(committed) => self.absorb(&running.job, committed),
                Err(error) => log::error!("ジョブの結果を保存できませんでした: {error}"),
            }
        }
        self.settle_waiters();
    }

    /// 確定した結果を反映する: 新しい割り振りの記録 → まとめの完了 → サブタスクの判定 → 振り分け
    fn absorb(&mut self, job: &JobSpec, committed: Committed) {
        let Committed { routing, ending, delegation } = committed;
        if let (Some(delegation), Ending::Replied { message, .. }) = (delegation, &ending) {
            self.track(delegation, message, job);
        }
        self.finish_report(job, &ending);
        self.judge_subtask(job, &ending);
        if let Some((routing, origin)) = routing {
            self.apply(routing, &origin);
        }
    }

    pub(super) fn post_notice(&self, origin: &Origin, content: &str) {
        if let Err(error) = posting::post_notice(&self.ports, origin, content) {
            log::error!("お知らせを保存できませんでした: {error}");
        }
    }

    fn publish_activity(&mut self) {
        let state = activity::build(self.state.running.values(), self.state.lanes.iter());
        let changed = *self.activity_tx.borrow() != state;
        if changed {
            self.ports.events.activity_changed(&state);
            self.activity_tx.send_replace(state);
        }
    }
}
