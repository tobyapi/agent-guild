//! アクター本体: コマンドを1つずつ処理し、そのたびに割り振りを見直し、始められるジョブを始めて、
//! 実行状況が変わったら知らせる。

use guild_domain::activity::{ActivityState, THINKING};
use guild_domain::conversation::JobSpec;
use tokio::sync::{mpsc, watch};

use super::state::{DispatchState, Pending, Running};
use super::stopping::StopWaiter;
use super::Command;
use crate::conversation::executor::{self, Committed, Ending, RunOutcome};
use crate::conversation::posting::{self, Origin};
use crate::conversation::{activity, interrupted, MAX_CONCURRENT_JOBS};
use crate::services::Ports;

pub(super) struct Actor {
    pub(super) ports: Ports,
    pub(super) sender: mpsc::UnboundedSender<Command>,
    activity_tx: watch::Sender<ActivityState>,
    pub(super) state: DispatchState,
    pub(super) waiters: Vec<StopWaiter>,
    /// 最後に保存した、待機・実行中のジョブの要約（inflight.rs）
    pub(super) recorded: String,
}

impl Actor {
    pub fn new(
        ports: Ports,
        sender: mpsc::UnboundedSender<Command>,
        activity_tx: watch::Sender<ActivityState>,
    ) -> Self {
        let recorded = interrupted::EMPTY.to_owned();
        Self { ports, sender, activity_tx, state: DispatchState::default(), waiters: Vec::new(), recorded }
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
            Command::ConfigureWorkspace { channel, mode, folder, done } => {
                let result = self.configure_workspace(&channel, mode, folder);
                let _ = done.send(result);
            }
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
            Command::Post { job_id, text } => self.post_progress(&job_id, &text),
            Command::Finished { job_id, outcome } => self.finish(&job_id, outcome),
            Command::Stop { channel, announce, done } => self.stop(channel, announce, done),
            Command::StopAll { done } => self.stop_all(done),
            Command::RemoveAgent { agent, channel, done } => {
                self.remove_agent(&agent, channel.as_ref());
                let _ = done.send(());
            }
        }
    }

    fn configure_workspace(
        &self,
        id: &guild_domain::ids::ChannelId,
        mode: guild_domain::channel::WorkspaceMode,
        folder: Option<String>,
    ) -> crate::error::AppResult<guild_domain::channel::Channel> {
        use crate::error::AppError;
        use guild_domain::channel::{ChannelWorkspace, WorkspaceMode};
        if self.state.jobs().any(|job| &job.channel_id == id)
            || self.state.delegations.values().any(|tracked| &tracked.delegation.channel_id == id)
        {
            return Err(AppError::validation("作業フォルダを変更する前に、このチャンネルの作業を停止してください"));
        }
        let mut channel = posting::require_channel(&self.ports, id)?;
        let folder = match (mode, folder) {
            (WorkspaceMode::Folder, Some(folder)) if !folder.trim().is_empty() => {
                Some(self.ports.workspace.validate_folder(folder.trim())?)
            }
            (WorkspaceMode::Folder, _) => return Err(AppError::validation("割り当てるフォルダを指定してください")),
            (_, None) => None,
            _ => return Err(AppError::validation("フォルダモード以外では割り当てを空にしてください")),
        };
        if channel.workspace.mode == mode && channel.workspace.folder == folder {
            return Ok(channel);
        }
        let after_seq = self
            .ports
            .messages
            .list(id, crate::ports::MessageFilter::All, None, 1)?
            .last()
            .map_or(0, |message| message.seq);
        channel.workspace = ChannelWorkspace {
            mode,
            folder,
            after_seq,
            revision: channel
                .workspace
                .revision
                .checked_add(1)
                .ok_or_else(|| AppError::validation("作業場所の更新回数が上限に達しました"))?,
        };
        self.ports.channels.set_workspace(&channel.id, &channel.workspace)?;
        self.ports.events.state_changed();
        Ok(channel)
    }

    /// 全体の上限まで、始められるジョブを始める（選び方は pick.rs）
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

    /// 実行が終わった: 世代が変わらず取り消されてもいなければ、結果を保存して振り分ける
    fn finish(&mut self, job_id: &str, outcome: RunOutcome) {
        let Some(running) = self.state.running.remove(job_id) else {
            return;
        };
        if self.state.is_current(&running) {
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
