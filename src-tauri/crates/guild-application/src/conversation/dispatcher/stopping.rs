//! 停止と取り消し（design.md §9）: 待機の破棄・実行中の中断・世代の更新・割り振りの打ち切りと、終端を待つ依頼への応答。

use guild_domain::conversation::{notices, JobSpec};
use guild_domain::ids::{AgentId, ChannelId};
use tokio::sync::oneshot;

use super::actor::Actor;
use crate::conversation::posting;

/// 実行中ジョブの終端を待っている停止の依頼
pub(super) struct StopWaiter {
    /// None なら全チャンネル
    channel: Option<ChannelId>,
    /// 終端のあとで「停止しました」を出す
    announce: bool,
    done: oneshot::Sender<()>,
}

impl Actor {
    /// そのチャンネルの待機（割り振りの枠を含む）を破棄し、実行中に cancel を送り、世代を上げ、割り振りを打ち切る。
    /// 終端を待ってから（止めたものがあれば）「停止しました」を出して応える
    pub(super) fn stop(&mut self, channel: ChannelId, announce: bool, done: oneshot::Sender<()>) {
        let lane = self.state.lanes.entry(channel.clone()).or_default();
        let had_pending = lane.waiting().next().is_some();
        lane.retain(|_| false);
        lane.generation += 1;
        let cancelled = self.cancel_running(|job| job.channel_id == channel);
        self.cancel_delegations(|delegation| delegation.channel_id == channel);
        let announce = announce && (had_pending || cancelled > 0);
        self.waiters.push(StopWaiter { channel: Some(channel), announce, done });
        self.state.prune_roots();
        self.settle_waiters();
    }

    /// 全チャンネルを止め、すべての終端を待ってから応える（お知らせは出さない）
    pub(super) fn stop_all(&mut self, done: oneshot::Sender<()>) {
        for lane in self.state.lanes.values_mut() {
            lane.retain(|_| false);
            lane.generation += 1;
        }
        self.cancel_running(|_| true);
        self.cancel_delegations(|_| true);
        self.waiters.push(StopWaiter { channel: None, announce: false, done });
        self.state.prune_roots();
        self.settle_waiters();
    }

    /// エージェントの待機を除き、実行中なら中断して結果を捨て、割り振りから外す（channel が None なら全チャンネル）
    pub(super) fn remove_agent(&mut self, agent: &AgentId, channel: Option<&ChannelId>) {
        let in_scope = |id: &ChannelId| channel.is_none_or(|target| target == id);
        for (id, lane) in self.state.lanes.iter_mut() {
            if in_scope(id) {
                lane.retain(|job| &job.agent_id != agent);
            }
        }
        let targets: Vec<String> = self
            .state
            .running
            .iter_mut()
            .filter(|(_, running)| &running.job.agent_id == agent && in_scope(&running.job.channel_id))
            .map(|(id, running)| {
                running.discarded = true;
                id.clone()
            })
            .collect();
        for job_id in targets {
            self.cancel_job(job_id);
        }
        self.release_delegations(agent, channel);
        self.state.prune_roots();
    }

    /// 条件に合う実行中のジョブを中断する。中断を依頼した数を返す
    fn cancel_running(&mut self, matches: impl Fn(&JobSpec) -> bool) -> usize {
        let targets: Vec<String> = self
            .state
            .running
            .iter()
            .filter(|(_, running)| matches(&running.job))
            .map(|(id, _)| id.clone())
            .collect();
        let count = targets.len();
        for job_id in targets {
            self.cancel_job(job_id);
        }
        count
    }

    /// ランナーへの cancel は別タスクで送る（アクターを待たせない）
    fn cancel_job(&self, job_id: String) {
        let runtime = self.ports.runtime.clone();
        self.ports.spawner.spawn(Box::pin(async move { runtime.cancel(&job_id).await }));
    }

    /// 待っている依頼のうち、対象の実行中ジョブがなくなったものに応える
    pub(super) fn settle_waiters(&mut self) {
        for waiter in std::mem::take(&mut self.waiters) {
            if self.state.has_running_in(waiter.channel.as_ref()) {
                self.waiters.push(waiter);
                continue;
            }
            if let (true, Some(channel)) = (waiter.announce, &waiter.channel) {
                if let Err(error) = posting::post_system(&self.ports, channel, notices::STOPPED) {
                    log::error!("「停止しました」を保存できませんでした: {error}");
                }
            }
            let _ = waiter.done.send(());
        }
    }
}
