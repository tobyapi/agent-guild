//! 毎回の処理のあとの割り振りの見直し: 相談の連鎖が途切れたサブタスクの決着・待ち合わせとまとめのジョブ・
//! まとめのジョブが積めなかった（消えた）割り振りの完了。

use guild_domain::conversation::{JobMode, JobSpec};
use guild_domain::delegation::{DelegationStatus, Settlement, SubtaskRef, SubtaskStatus, NOT_STARTED, NO_ANSWER};
use guild_domain::ids::{DelegationId, SubtaskId};

use super::actor::Actor;

impl Actor {
    /// 全サブタスクが決着した割り振りは reporting にしてマネージャーのまとめのジョブをレーンに積む。
    /// まとめのジョブがなくなった reporting の割り振りは done にする（まとめの発言は null）
    pub(super) fn reconcile_delegations(&mut self) {
        for id in self.tracked_ids(|_| true) {
            for (subtask, settlement) in self.orphans(&id) {
                self.change(&id, |delegation, now| delegation.settle_subtask(&subtask, settlement, now));
            }
            if self.change(&id, |delegation, now| delegation.begin_report(now)) {
                self.enqueue_report(&id);
            }
            let reporting = self.state.delegations.get(&id).is_some_and(|tracked| {
                tracked.delegation.status == DelegationStatus::Reporting
            });
            if reporting && !self.state.jobs().any(|job| job.report.as_ref() == Some(&id)) {
                self.change(&id, |delegation, now| delegation.finish(None, now));
            }
        }
    }

    /// 決着していないのに、それを進めるジョブ（と入れ子の割り振り）がなくなったサブタスクと、その決着のしかた:
    /// 作業中なら最後の返答を結果にし（なければ回答なし）、実行されないまま消えたなら failed
    fn orphans(&self, id: &DelegationId) -> Vec<(SubtaskId, Settlement)> {
        let Some(tracked) = self.state.delegations.get(id) else {
            return Vec::new();
        };
        tracked
            .delegation
            .subtasks
            .iter()
            .filter(|subtask| subtask.status.is_open() && !self.is_carried(id, &subtask.id))
            .map(|subtask| {
                let settlement = match (subtask.status, tracked.messages.get(&subtask.id)) {
                    (SubtaskStatus::Running, Some(last)) => Settlement::Done(last.id.clone()),
                    (SubtaskStatus::Running, None) => Settlement::Failed { note: NO_ANSWER, message: None },
                    _ => Settlement::Failed { note: NOT_STARTED, message: None },
                };
                (subtask.id.clone(), settlement)
            })
            .collect()
    }

    /// そのサブタスクを進めるジョブ（待機・実行中）か、それを待つ入れ子の割り振りがあるか
    fn is_carried(&self, delegation: &DelegationId, subtask: &SubtaskId) -> bool {
        let points_here = |target: &SubtaskRef| &target.delegation_id == delegation && &target.subtask_id == subtask;
        self.state.jobs().any(|job| job.subtask.as_ref().is_some_and(points_here))
            || self.state.delegations.values().any(|tracked| tracked.parent.as_ref().is_some_and(points_here))
    }

    /// マネージャーのまとめのジョブ（きっかけは各サブタスクの結果の発言。入れ子なら待っているサブタスクを引き継ぐ）
    fn enqueue_report(&mut self, id: &DelegationId) {
        let Some(tracked) = self.state.delegations.get(id) else {
            return;
        };
        let triggers = tracked.results();
        let depth = triggers.iter().map(|message| message.depth).max().unwrap_or(tracked.depth + 1) + 1;
        let job = JobSpec {
            agent_id: tracked.delegation.manager_id.clone(),
            channel_id: tracked.delegation.channel_id.clone(),
            mode: JobMode::Report,
            triggers,
            return_to: Vec::new(),
            depth,
            root_id: Some(tracked.root_id.clone()),
            notes: Vec::new(),
            subtask: tracked.parent.clone(),
            report: Some(id.clone()),
        };
        self.accept(job);
    }
}
