//! 次に始めるジョブの選び方（design.md §6）: レーンはチャンネルごとに直列、割り振りの枠は並行。どちらもエージェント単位の排他を守る。

use guild_domain::ids::ChannelId;

use super::state::{DispatchState, Pending};

/// 次に始めるジョブの場所
pub(crate) enum Pick {
    Lane(ChannelId),
    Delegated(ChannelId, usize),
}

impl DispatchState {
    /// 次に始めるジョブ: 実行中のジョブがない（チャンネルごとに直列）レーンの先頭と、割り振りの枠の全ジョブのうち、
    /// エージェントが空いていて、積んだのがいちばん古いもの。レーンの先頭のエージェントが他で実行中なら、そのレーンは待つ
    pub fn next_startable(&self) -> Option<Pick> {
        let heads = self
            .lanes
            .iter()
            .filter(|(id, _)| !self.has_lane_running(id))
            .filter_map(|(id, lane)| lane.pending.front().map(|head| (head, Pick::Lane(id.clone()))));
        let delegated = self.lanes.iter().flat_map(|(id, lane)| {
            lane.delegated.iter().enumerate().map(move |(index, pending)| (pending, Pick::Delegated(id.clone(), index)))
        });
        heads
            .chain(delegated)
            .filter(|(pending, _)| !self.is_busy(&pending.job.agent_id))
            .min_by_key(|(pending, _)| pending.ticket)
            .map(|(_, pick)| pick)
    }

    /// 選んだ待機ジョブを取り出す（いまの世代と一緒に）
    pub fn take(&mut self, pick: Pick) -> Option<(Pending, u64)> {
        let (channel, index) = match pick {
            Pick::Lane(channel) => (channel, None),
            Pick::Delegated(channel, index) => (channel, Some(index)),
        };
        let lane = self.lanes.get_mut(&channel)?;
        let pending = match index {
            None => lane.pending.pop_front()?,
            Some(index) if index < lane.delegated.len() => lane.delegated.remove(index),
            Some(_) => return None,
        };
        Some((pending, lane.generation))
    }

    /// そのレーンで（割り振りの枠の外で）実行中のジョブがあるか
    fn has_lane_running(&self, channel: &ChannelId) -> bool {
        self.running
            .values()
            .any(|running| &running.job.channel_id == channel && !running.job.is_delegated())
    }
}
