//! 実行管理の状態から activity-changed のペイロード（ActivityState）を作る。

use std::collections::BTreeMap;

use guild_domain::activity::{ActivityState, AgentActivity, ChannelQueue};
use guild_domain::ids::ChannelId;

use super::dispatcher::state::{Lane, Running};

/// 実行中の様子（始めた順）と、待機・実行中のジョブがあるチャンネルの数（チャンネル ID 順）
pub(super) fn build<'a>(
    running: impl Iterator<Item = &'a Running>,
    lanes: impl Iterator<Item = (&'a ChannelId, &'a Lane)>,
) -> ActivityState {
    let mut running: Vec<&Running> = running.collect();
    running.sort_by_key(|job| job.ticket);
    let mut counts: BTreeMap<ChannelId, (u32, u32)> = BTreeMap::new();
    for job in &running {
        counts.entry(job.job.channel_id.clone()).or_default().0 += 1;
    }
    for (channel, lane) in lanes {
        let pending = u32::try_from(lane.waiting().count()).unwrap_or(u32::MAX);
        if pending > 0 {
            counts.entry(channel.clone()).or_default().1 += pending;
        }
    }
    ActivityState {
        activities: running
            .iter()
            .map(|job| AgentActivity {
                agent_id: job.job.agent_id.clone(),
                channel_id: job.job.channel_id.clone(),
                detail: job.detail.clone(),
            })
            .collect(),
        queues: counts
            .into_iter()
            .map(|(channel_id, (running, pending))| ChannelQueue { channel_id, running, pending })
            .collect(),
    }
}
