//! 次に始めるジョブの選び方（design.md §6）: レーンの中は会話（起点）ごとに直列、割り振りの枠は並行。
//! どちらもエージェント単位の排他を守る。手の空いていないエージェントのジョブは、同じ会話の後ろだけを待たせる。

use guild_domain::conversation::JobSpec;
use guild_domain::ids::ChannelId;

use super::state::{DispatchState, Lane, Pending};

/// 次に始めるジョブの場所（レーンの待機か割り振りの枠と、その中の位置）
pub(crate) enum Pick {
    Lane(ChannelId, usize),
    Delegated(ChannelId, usize),
}

impl DispatchState {
    /// 次に始めるジョブ: 会話の順番が来ているレーンの待機ジョブと、割り振りの枠の全ジョブのうち、
    /// エージェントが空いていて、積んだのがいちばん古いもの
    pub fn next_startable(&self) -> Option<Pick> {
        let lanes = self.lanes.iter().flat_map(|(id, lane)| self.lane_candidates(id, lane));
        let delegated = self.lanes.iter().flat_map(|(id, lane)| {
            lane.delegated.iter().enumerate().map(move |(index, pending)| (pending, Pick::Delegated(id.clone(), index)))
        });
        lanes
            .chain(delegated)
            .filter(|(pending, _)| !self.is_busy(&pending.job.agent_id))
            .min_by_key(|(pending, _)| pending.ticket)
            .map(|(_, pick)| pick)
    }

    /// 選んだ待機ジョブを取り出す（いまの世代と一緒に）
    pub fn take(&mut self, pick: Pick) -> Option<(Pending, u64)> {
        let (channel, index, delegated) = match pick {
            Pick::Lane(channel, index) => (channel, index, false),
            Pick::Delegated(channel, index) => (channel, index, true),
        };
        let lane = self.lanes.get_mut(&channel)?;
        let pending = if delegated {
            (index < lane.delegated.len()).then(|| lane.delegated.remove(index))?
        } else {
            lane.pending.remove(index)?
        };
        Some((pending, lane.generation))
    }

    /// レーンの待機ジョブのうち、会話の順番が来ているもの。同じ会話のジョブが実行中か、先に積まれて待っていれば待つ
    /// （会話の中では、各エージェントが直前の返答を読んでから話す）。会話を持たない自発活動は、レーンで何も実行していないときだけ
    fn lane_candidates<'a>(&'a self, channel: &ChannelId, lane: &'a Lane) -> Vec<(&'a Pending, Pick)> {
        let running: Vec<&JobSpec> = self
            .running
            .values()
            .filter(|running| &running.job.channel_id == channel && !running.job.is_delegated())
            .map(|running| &running.job)
            .collect();
        let mut candidates = Vec::new();
        for (index, pending) in lane.pending.iter().enumerate() {
            let job = &pending.job;
            let waiting = if job.conversations().next().is_none() {
                !running.is_empty()
            } else {
                let earlier = lane.pending.iter().take(index).map(|earlier| &earlier.job);
                running.iter().copied().chain(earlier).any(|other| other.shares_conversation(job))
            };
            if !waiting {
                candidates.push((pending, Pick::Lane(channel.clone(), index)));
            }
        }
        candidates
    }
}
