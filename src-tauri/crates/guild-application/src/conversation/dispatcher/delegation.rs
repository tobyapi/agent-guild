//! 割り振りの進行（design.md §7.1）: サブタスクの開始と決着、待ち合わせとまとめのジョブ、打ち切り。
//! 変わるたびに保存して delegation-changed を出す。終わった割り振りは記録から外す。

use std::collections::HashMap;

use guild_domain::conversation::JobSpec;
use guild_domain::delegation::{judge, Delegation, SubtaskRef, Verdict};
use guild_domain::ids::{AgentId, ChannelId, DelegationId};
use guild_domain::locale;
use guild_domain::message::Message;

use super::actor::Actor;
use super::tracking::Tracked;
use crate::conversation::executor::Ending;
use crate::services::Ports;

impl Actor {
    /// 返答 reply（ジョブ job の結果）から作った割り振りを記録する
    pub(super) fn track(&mut self, delegation: Delegation, reply: &Message, job: &JobSpec) {
        let parent = job.subtask.clone().filter(|target| target.assignee_id == job.agent_id);
        let tracked = Tracked {
            delegation,
            root_id: reply.root_id.clone(),
            depth: reply.depth,
            parent,
            messages: HashMap::new(),
        };
        self.state.delegations.insert(tracked.delegation.id.clone(), tracked);
    }

    /// 担当者のジョブが始まった: サブタスクを running に
    pub(super) fn subtask_started(&mut self, job: &JobSpec) {
        if let Some(target) = job.subtask.as_ref().filter(|target| target.assignee_id == job.agent_id) {
            self.change(&target.delegation_id, |delegation, now| delegation.start_subtask(&target.subtask_id, now));
        }
    }

    /// サブタスクを持つジョブが担当者のジョブとして終わった: 決着を判定する（何も起きなかったなら reconcile に任せる）
    pub(super) fn judge_subtask(&mut self, job: &JobSpec, ending: &Ending) {
        let Some(target) = job.subtask.as_ref().filter(|target| target.assignee_id == job.agent_id) else {
            return;
        };
        let Some(turn) = ending.turn() else {
            return;
        };
        let verdict = judge(turn, locale::current());
        self.remember(target, ending.message());
        if let Verdict::Settle(settlement) = verdict {
            self.change(&target.delegation_id, |delegation, now| {
                delegation.settle_subtask(&target.subtask_id, settlement, now)
            });
        }
    }

    /// まとめのジョブが終わった: 割り振りを done に（[PASS]・失敗ならまとめの発言は null）
    pub(super) fn finish_report(&mut self, job: &JobSpec, ending: &Ending) {
        let Some(id) = &job.report else {
            return;
        };
        if ending.turn().is_none() {
            return;
        }
        let summary = match ending {
            Ending::Replied { message, .. } => Some(message.id.clone()),
            _ => None,
        };
        self.change(id, |delegation, now| delegation.finish(summary, now));
    }

    /// 条件に合う進行中の割り振りを打ち切る（未決着のサブタスクも cancelled）
    pub(super) fn cancel_delegations(&mut self, matches: impl Fn(&Delegation) -> bool) {
        let ids: Vec<DelegationId> = self.tracked_ids(|tracked| matches(&tracked.delegation));
        for id in ids {
            self.change(&id, |delegation, now| delegation.cancel(now));
            self.state.lanes.values_mut().for_each(|lane| lane.retain(|job| !belongs_to(job, &id)));
        }
    }

    /// エージェントが外れた（channel が None なら全チャンネル）: マネージャーとして持つ割り振りは打ち切り、
    /// 担当している未決着のサブタスクは failed「担当者が外れました」
    pub(super) fn release_delegations(&mut self, agent: &AgentId, channel: Option<&ChannelId>) {
        let in_scope = |delegation: &Delegation| channel.is_none_or(|id| &delegation.channel_id == id);
        self.cancel_delegations(|delegation| in_scope(delegation) && &delegation.manager_id == agent);
        for id in self.tracked_ids(|tracked| in_scope(&tracked.delegation)) {
            let language = locale::current();
            self.change(&id, |delegation, now| delegation.fail_assignee(agent, language, now));
        }
    }

    /// 発言を覚えておく（待ち中の返答・結果・エラー）
    fn remember(&mut self, target: &SubtaskRef, message: Option<&Message>) {
        if let (Some(tracked), Some(message)) = (self.state.delegations.get_mut(&target.delegation_id), message) {
            tracked.messages.insert(target.subtask_id.clone(), message.clone());
        }
    }

    pub(super) fn tracked_ids(&self, matches: impl Fn(&Tracked) -> bool) -> Vec<DelegationId> {
        self.state.delegations.values().filter(|tracked| matches(tracked)).map(|t| t.delegation.id.clone()).collect()
    }

    /// 割り振りを変える。変わったら保存して delegation-changed を出し、終わったら記録から外す
    pub(super) fn change(&mut self, id: &DelegationId, apply: impl FnOnce(&mut Delegation, i64) -> bool) -> bool {
        let now = self.ports.clock.now_ms();
        let Some(tracked) = self.state.delegations.get_mut(id) else {
            return false;
        };
        if !apply(&mut tracked.delegation, now) {
            return false;
        }
        save(&self.ports, &tracked.delegation);
        if !tracked.delegation.status.is_open() {
            self.state.delegations.remove(id);
        }
        true
    }
}

/// 割り振り id のためだけのジョブ（そのまとめのジョブと、割り振りの枠でそのサブタスクを進めるジョブ）。
/// 入れ子の割り振りのまとめのジョブは、引き継いだサブタスクが打ち切られても残す（その割り振り自身のまとめなので）
fn belongs_to(job: &JobSpec, id: &DelegationId) -> bool {
    job.report.as_ref() == Some(id)
        || (job.is_delegated() && job.subtask.as_ref().is_some_and(|target| &target.delegation_id == id))
}

fn save(ports: &Ports, delegation: &Delegation) {
    if let Err(error) = ports.delegations.update(delegation) {
        log::error!("割り振りを保存できませんでした: {error}");
    }
    ports.events.delegation_changed(delegation);
}
