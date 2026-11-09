//! アクターだけが触る実行管理の状態: レーン（チャンネルごとの待機 FIFO・割り振りの枠・世代）・実行中のジョブ・
//! 起点ごとの記録・進行中の割り振り。

use std::collections::{HashMap, VecDeque};

use guild_domain::conversation::JobSpec;
use guild_domain::ids::{AgentId, ChannelId, DelegationId, MessageId};

use super::tracking::Tracked;

/// 待機中のジョブ。ticket は積んだ順（レーン間の公平さに使う）
pub(crate) struct Pending {
    pub ticket: u64,
    pub job: JobSpec,
}

/// 実行中のジョブ
pub(crate) struct Running {
    pub ticket: u64,
    pub job: JobSpec,
    /// 始めたときのレーンの世代（停止・削除で変わっていたら結果を捨てる）
    pub generation: u64,
    /// エージェントの削除・除外で取り消された（結果を捨てる）
    pub discarded: bool,
    /// いまの様子（「考え中…」「Web検索: …」）
    pub detail: String,
}

#[derive(Default)]
pub(crate) struct Lane {
    /// レーンの待機ジョブ（積んだ順。同じ会話のジョブは順番に実行する。pick.rs）
    pub pending: VecDeque<Pending>,
    /// 割り振りの枠（§6）: レーンの順番を待たずに並行して実行する待機ジョブ
    pub delegated: Vec<Pending>,
    pub generation: u64,
}

impl Lane {
    pub fn waiting(&self) -> impl Iterator<Item = &Pending> {
        self.pending.iter().chain(self.delegated.iter())
    }

    /// 待機を条件で残す（レーンと割り振りの枠の両方）
    pub fn retain(&mut self, keep: impl Fn(&JobSpec) -> bool) {
        self.pending.retain(|pending| keep(&pending.job));
        self.delegated.retain(|pending| keep(&pending.job));
    }
}

/// 起点ごとの記録（往復の上限のお知らせを1回だけ出すため）
#[derive(Default)]
pub(crate) struct RootState {
    pub depth_notified: bool,
}

#[derive(Default)]
pub(crate) struct DispatchState {
    pub lanes: HashMap<ChannelId, Lane>,
    /// ジョブ ID → 実行中のジョブ
    pub running: HashMap<String, Running>,
    pub roots: HashMap<MessageId, RootState>,
    /// 進行中（running / reporting）の割り振り
    pub delegations: HashMap<DelegationId, Tracked>,
    next_ticket: u64,
}

impl DispatchState {
    pub fn ticket(&mut self) -> u64 {
        self.next_ticket += 1;
        self.next_ticket
    }

    /// 実行中のジョブの結果をまだ受け取ってよいか（取り消されておらず、チャンネルの世代も変わっていない）
    pub fn is_current(&self, running: &Running) -> bool {
        let generation = self.lanes.get(&running.job.channel_id).map(|lane| lane.generation);
        !running.discarded && generation == Some(running.generation)
    }

    /// そのエージェントが（どのチャンネルでも）実行中か
    pub fn is_busy(&self, agent: &AgentId) -> bool {
        self.running.values().any(|running| &running.job.agent_id == agent)
    }

    /// そのエージェントが（どのチャンネルでも）待機・実行中か
    pub fn has_work_for(&self, agent: &AgentId) -> bool {
        self.is_busy(agent) || self.jobs().any(|job| &job.agent_id == agent)
    }

    /// 待機と実行中のすべてのジョブ
    pub fn jobs(&self) -> impl Iterator<Item = &JobSpec> {
        let waiting = self.lanes.values().flat_map(|lane| lane.waiting().map(|pending| &pending.job));
        waiting.chain(self.running.values().map(|running| &running.job))
    }

    /// 合流できる待機ジョブ（同じ枠の中だけ）があれば合流して None。なければジョブをそのまま返す
    pub fn merge_into_pending(&mut self, job: JobSpec) -> Option<JobSpec> {
        let Some(lane) = self.lanes.get_mut(&job.channel_id) else {
            return Some(job);
        };
        let mergeable = |pending: &&mut Pending| pending.job.can_merge(&job);
        let found = if job.is_delegated() {
            lane.delegated.iter_mut().find(mergeable)
        } else {
            lane.pending.iter_mut().find(mergeable)
        };
        match found {
            Some(pending) => {
                pending.job.merge(job);
                None
            }
            None => Some(job),
        }
    }

    pub fn push(&mut self, job: JobSpec) {
        let pending = Pending { ticket: self.ticket(), job };
        let lane = self.lanes.entry(pending.job.channel_id.clone()).or_default();
        if pending.job.is_delegated() {
            lane.delegated.push(pending);
        } else {
            lane.pending.push_back(pending);
        }
    }

    /// 待機・実行中のジョブが残っていない起点の記録を捨てる
    pub fn prune_roots(&mut self) {
        let alive: Vec<MessageId> = self.jobs().filter_map(|job| job.root_id.clone()).collect();
        self.roots.retain(|root, _| alive.contains(root));
    }

    /// そのチャンネル（None なら全体）で実行中のジョブがあるか（割り振りの枠を含む）
    pub fn has_running_in(&self, channel: Option<&ChannelId>) -> bool {
        self.running
            .values()
            .any(|running| channel.is_none_or(|id| &running.job.channel_id == id))
    }
}
