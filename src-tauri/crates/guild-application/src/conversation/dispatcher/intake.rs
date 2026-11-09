//! ジョブの受け入れ: 振り分けの結果の反映（参加・お知らせ・ジョブ）と合流。

use guild_domain::conversation::{JobSpec, Notice, Routing};

use super::actor::Actor;
use crate::conversation::posting::{self, Origin};

impl Actor {
    /// 振り分けの結果を反映する: 参加 → お知らせ → ジョブ
    pub(super) fn apply(&mut self, routing: Routing, origin: &Origin) {
        if let Err(error) = posting::join(&self.ports, origin, &routing.joins) {
            log::error!("チャンネルへの参加を保存できませんでした: {error}");
        }
        for notice in &routing.notices {
            self.notify(notice, origin);
        }
        for job in routing.jobs {
            self.accept(job);
        }
    }

    /// 上限のお知らせは起点ごとに1回だけ
    fn notify(&mut self, notice: &Notice, origin: &Origin) {
        if *notice == Notice::DepthLimit {
            let root = self.state.roots.entry(origin.root_id.clone()).or_default();
            if root.depth_notified {
                return;
            }
            root.depth_notified = true;
        }
        self.post_notice(origin, &notice.text());
    }

    /// 待機ジョブに合流できれば合流し、新しいジョブなら積む。
    /// 終わった割り振りのサブタスクを持つジョブは、ふつうのジョブとしてレーンに積む
    pub(super) fn accept(&mut self, mut job: JobSpec) {
        if job.subtask.as_ref().is_some_and(|target| !self.state.delegations.contains_key(&target.delegation_id)) {
            job.subtask = None;
        }
        if let Some(job) = self.state.merge_into_pending(job) {
            self.state.push(job);
        }
    }
}
