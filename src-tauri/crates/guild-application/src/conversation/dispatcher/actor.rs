//! アクター本体: コマンドを1つずつ処理し、そのたびに割り振りを見直し、始められるジョブを始めて、
//! 実行状況が変わったら知らせる。

use guild_domain::activity::{ActivityState, THINKING};
use guild_domain::conversation::JobSpec;
use tokio::sync::{mpsc, watch};

use super::state::{DispatchState, Pending, Running};
use super::stopping::StopWaiter;
use super::Command;
use crate::conversation::executor::{self, Committed, Ending, JobReporter, RunOutcome};
use crate::conversation::posting::{self, Origin};
use crate::conversation::{activity, MAX_CONCURRENT_JOBS};
use crate::services::Ports;

pub(super) struct Actor {
    pub(super) ports: Ports,
    sender: mpsc::UnboundedSender<Command>,
    activity_tx: watch::Sender<ActivityState>,
    pub(super) state: DispatchState,
    pub(super) waiters: Vec<StopWaiter>,
}

impl Actor {
    pub fn new(ports: Ports, sender: mpsc::UnboundedSender<Command>, activity_tx: watch::Sender<ActivityState>) -> Self {
        Self { ports, sender, activity_tx, state: DispatchState::default(), waiters: Vec::new() }
    }

    pub async fn run(mut self, mut receiver: mpsc::UnboundedReceiver<Command>) {
        while let Some(command) = receiver.recv().await {
            self.handle(command);
            self.reconcile_delegations();
            self.pump();
            self.publish_activity();
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
            Command::Finished { job_id, outcome } => self.finish(&job_id, outcome),
            Command::Stop { channel, announce, done } => self.stop(channel, announce, done),
            Command::StopAll { done } => self.stop_all(done),
            Command::RemoveAgent { agent, channel, done } => {
                self.remove_agent(&agent, channel.as_ref());
                let _ = done.send(());
            }
        }
    }

    /// 全体の上限まで、始められるレーンの先頭ジョブを始める
    fn pump(&mut self) {
        while self.state.running.len() < MAX_CONCURRENT_JOBS {
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
            detail: THINKING.to_owned(),
        };
        self.state.running.insert(job_id.clone(), running);
        self.subtask_started(&pending.job);
        let task = executor::run(self.ports.clone(), job_id, pending.job, reporter);
        self.ports.spawner.spawn(Box::pin(task));
    }

    /// 実行タスクからの報告をコマンドとして受け取る
    fn reporter(&self, job_id: &str) -> JobReporter {
        let (activity, finished) = (self.sender.clone(), self.sender.clone());
        let (activity_id, finished_id) = (job_id.to_owned(), job_id.to_owned());
        JobReporter::new(
            move |detail| {
                let _ = activity.send(Command::Activity { job_id: activity_id.clone(), detail });
            },
            move |outcome| {
                let _ = finished.send(Command::Finished { job_id: finished_id, outcome });
            },
        )
    }

    /// 実行が終わった: 世代が変わらず取り消されてもいなければ、結果を保存して振り分ける
    fn finish(&mut self, job_id: &str, outcome: RunOutcome) {
        let Some(running) = self.state.running.remove(job_id) else {
            return;
        };
        let generation = self.state.lanes.get(&running.job.channel_id).map(|lane| lane.generation);
        if !running.discarded && generation == Some(running.generation) {
            match executor::commit(&self.ports, &running.job, outcome) {
                Ok(committed) => self.absorb(&running.job, committed),
                Err(error) => log::error!("ジョブの結果を保存できませんでした: {error}"),
            }
        }
        self.state.prune_roots();
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
