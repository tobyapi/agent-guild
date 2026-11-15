//! 実行管理（design.md §6）を持つ単一タスクのアクター。レーン（チャンネルごとの FIFO と合流）・割り振りの枠・
//! エージェント単位の排他・全体の同時実行上限・世代・往復の上限のお知らせ・進行中の割り振り（§7.1）を1か所に持ち、
//! mpsc のコマンドだけで動く（共有ロックなし）。

mod actor;
mod delegation;
mod inflight;
mod intake;
mod pick;
mod reconcile;
mod reporting;
pub(super) mod state;
mod stopping;
mod tracking;

use std::time::Duration;

use guild_domain::activity::ActivityState;
use guild_domain::conversation::{JobSpec, Routing};
use guild_domain::ids::{AgentId, ChannelId};
use tokio::sync::{mpsc, oneshot, watch};

use super::executor::RunOutcome;
use super::posting::Origin;
use crate::services::Ports;
use actor::Actor;

/// 停止の終端を待つ上限（ランナーが応答しなくてもコマンドが戻るように）
const STOP_WAIT: Duration = Duration::from_secs(30);

pub(super) enum Command {
    /// 振り分けの結果を反映する（参加・お知らせ・ジョブ）
    Dispatch {
        routing: Routing,
        origin: Origin,
    },
    Enqueue(Vec<JobSpec>),
    /// そのエージェントがどこかで待機・実行中なら積まない
    EnqueueAutonomous {
        job: JobSpec,
        reply: oneshot::Sender<bool>,
    },
    Activity {
        job_id: String,
        detail: String,
    },
    /// 作業の途中の投稿（振り分けはしない）
    Post {
        job_id: String,
        text: String,
    },
    Finished {
        job_id: String,
        outcome: RunOutcome,
    },
    /// announce = 終端を待ってから「停止しました」を出す
    Stop {
        channel: ChannelId,
        announce: bool,
        done: oneshot::Sender<()>,
    },
    StopAll {
        done: oneshot::Sender<()>,
    },
    /// channel が None なら全チャンネルから（エージェントの削除）
    RemoveAgent {
        agent: AgentId,
        channel: Option<ChannelId>,
        done: oneshot::Sender<()>,
    },
}

/// アクターへの入口
#[derive(Clone)]
pub(super) struct DispatcherHandle {
    sender: mpsc::UnboundedSender<Command>,
    activity: watch::Receiver<ActivityState>,
}

/// アクターを起動する
pub(super) fn start(ports: Ports) -> DispatcherHandle {
    let (sender, receiver) = mpsc::unbounded_channel();
    let (activity_tx, activity) = watch::channel(ActivityState::default());
    let actor = Actor::new(ports.clone(), sender.clone(), activity_tx);
    ports.spawner.spawn(Box::pin(actor.run(receiver)));
    DispatcherHandle { sender, activity }
}

impl DispatcherHandle {
    pub fn dispatch(&self, routing: Routing, origin: Origin) {
        self.send(Command::Dispatch { routing, origin });
    }

    pub fn enqueue(&self, jobs: Vec<JobSpec>) {
        if !jobs.is_empty() {
            self.send(Command::Enqueue(jobs));
        }
    }

    pub async fn enqueue_autonomous(&self, job: JobSpec) -> bool {
        let (reply, answer) = oneshot::channel();
        self.send(Command::EnqueueAutonomous { job, reply });
        answer.await.unwrap_or(false)
    }

    pub async fn stop(&self, channel: &ChannelId, announce: bool) {
        let (done, finished) = oneshot::channel();
        self.send(Command::Stop { channel: channel.clone(), announce, done });
        wait(finished).await;
    }

    pub async fn stop_all(&self) {
        let (done, finished) = oneshot::channel();
        self.send(Command::StopAll { done });
        wait(finished).await;
    }

    pub async fn remove_agent(&self, agent: &AgentId, channel: Option<&ChannelId>) {
        let (done, finished) = oneshot::channel();
        let channel = channel.cloned();
        self.send(Command::RemoveAgent { agent: agent.clone(), channel, done });
        wait(finished).await;
    }

    pub fn activity(&self) -> ActivityState {
        self.activity.borrow().clone()
    }

    fn send(&self, command: Command) {
        if self.sender.send(command).is_err() {
            log::error!("実行管理のタスクが止まっているため、依頼を処理できませんでした");
        }
    }
}

async fn wait(finished: oneshot::Receiver<()>) {
    if tokio::time::timeout(STOP_WAIT, finished).await.is_err() {
        log::warn!("実行中のジョブの終端を待ちきれませんでした（終わりしだい処理します）");
    }
}
