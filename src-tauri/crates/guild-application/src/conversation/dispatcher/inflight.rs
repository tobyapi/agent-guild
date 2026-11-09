//! 終了で消える待機・実行中のジョブの記録（design.md §6）: 処理のたびに、要約が前回の保存から変わっていれば
//! meta に保存する。次の起動での知らせ方は conversation/interrupted.rs。

use guild_domain::conversation::JobSpec;

use super::actor::Actor;
use crate::conversation::interrupted;

impl Actor {
    /// 待機と実行中（停止・取り消しで結果を捨てるものは除く）のジョブを積んだ順に要約し、変わっていれば保存する
    pub(super) fn record_inflight(&mut self) {
        let waiting =
            self.state.lanes.values().flat_map(|lane| lane.waiting().map(|pending| (pending.ticket, &pending.job)));
        let running = self
            .state
            .running
            .values()
            .filter(|running| self.state.is_current(running))
            .map(|running| (running.ticket, &running.job));
        let mut jobs: Vec<(u64, &JobSpec)> = waiting.chain(running).collect();
        jobs.sort_by_key(|(ticket, _)| *ticket);
        let summary = interrupted::encode(jobs.into_iter().map(|(_, job)| job));
        if summary == self.recorded {
            return;
        }
        match self.ports.meta.set(interrupted::KEY, &summary) {
            Ok(()) => self.recorded = summary,
            Err(error) => log::warn!("待機中のジョブの記録を保存できませんでした: {error}"),
        }
    }
}
