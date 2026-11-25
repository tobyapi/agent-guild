use std::collections::VecDeque;

use guild_domain::ids::ChannelId;
use guild_domain::locale;
use guild_domain::operation_approval::{ApprovalDecision, ApprovalRequest, ApprovalStatus, OperationApproval};
use tokio::sync::oneshot;

use super::{actor::Actor, Command, DispatcherHandle};

/// Keep recent results in memory for the current app session. Pending requests are never evicted.
const COMPLETED_LIMIT: usize = 30;

#[derive(Default)]
pub(super) struct Approvals {
    pending: Vec<Pending>,
    completed: VecDeque<OperationApproval>,
}

struct Pending {
    card: OperationApproval,
    responding: bool,
}

impl Approvals {
    fn list(&self, channel: &ChannelId) -> Vec<OperationApproval> {
        self.completed
            .iter()
            .chain(self.pending.iter().map(|pending| &pending.card))
            .filter(|card| &card.channel_id == channel)
            .cloned()
            .collect()
    }

    fn finish(&mut self, index: usize, status: ApprovalStatus) -> OperationApproval {
        let mut card = self.pending.remove(index).card;
        card.status = status;
        if self.completed.len() == COMPLETED_LIMIT {
            self.completed.pop_front();
        }
        self.completed.push_back(card.clone());
        card
    }
}

impl DispatcherHandle {
    pub(in crate::conversation) async fn list_approvals(&self, channel: ChannelId) -> Vec<OperationApproval> {
        let (reply, result) = oneshot::channel();
        self.send(Command::ListApprovals { channel, reply });
        result.await.unwrap_or_default()
    }

    pub(in crate::conversation) async fn decide_approval(
        &self,
        channel: ChannelId,
        id: String,
        decision: ApprovalDecision,
    ) -> bool {
        let (reply, result) = oneshot::channel();
        self.send(Command::DecideApproval { channel, id, decision, reply });
        result.await.unwrap_or(false)
    }
}

impl Actor {
    pub(super) fn list_approvals(&self, channel: &ChannelId, reply: oneshot::Sender<Vec<OperationApproval>>) {
        let _ = reply.send(self.approvals.list(channel));
    }

    pub(super) fn request_approval(&mut self, job_id: &str, request: ApprovalRequest) {
        let Some(running) = self.state.running.get(job_id).filter(|run| self.state.is_current(run)) else { return };
        if self.approvals.pending.iter().any(|pending| pending.card.request.request_id == request.request_id) {
            return;
        }
        let agent_name = self
            .ports
            .agents
            .get(&running.job.agent_id)
            .ok()
            .flatten()
            .map_or_else(|| running.job.agent_id.to_string(), |agent| agent.name);
        let card = OperationApproval {
            run_id: job_id.to_owned(),
            channel_id: running.job.channel_id.clone(),
            agent_name,
            request,
            status: ApprovalStatus::Pending,
        };
        self.ports.events.operation_approval_changed(&card);
        self.notify_approval(&card.agent_name);
        self.approvals.pending.push(Pending { card, responding: false });
    }

    pub(super) fn resolve_approval(&mut self, job_id: &str, id: &str, status: ApprovalStatus) {
        if let Some(index) = self
            .approvals
            .pending
            .iter()
            .position(|pending| pending.card.run_id == job_id && pending.card.request.request_id == id)
        {
            let card = self.approvals.finish(index, status);
            self.ports.events.operation_approval_changed(&card);
        }
    }

    pub(super) fn cancel_approvals(&mut self, job_id: &str) {
        while let Some(index) = self.approvals.pending.iter().position(|pending| pending.card.run_id == job_id) {
            let card = self.approvals.finish(index, ApprovalStatus::Cancelled);
            self.ports.events.operation_approval_changed(&card);
        }
    }

    pub(super) fn decide_approval(
        &mut self,
        channel: &ChannelId,
        id: String,
        decision: ApprovalDecision,
        reply: oneshot::Sender<bool>,
    ) {
        let pending = self.approvals.pending.iter_mut().find(|pending| {
            !pending.responding && &pending.card.channel_id == channel && pending.card.request.request_id == id
        });
        let Some(pending) = pending else {
            let _ = reply.send(false);
            return;
        };
        pending.responding = true;
        let run_id = pending.card.run_id.clone();
        let runtime = self.ports.runtime.clone();
        let sender = self.sender.clone();
        self.ports.spawner.spawn(Box::pin(async move {
            let sent = runtime.respond_to_approval(&run_id, &id, decision).await.unwrap_or(false);
            if !sent {
                let _ = sender.send(Command::ApprovalSendFailed { run_id, id });
            }
            let _ = reply.send(sent);
        }));
    }

    pub(super) fn approval_send_failed(&mut self, job_id: &str, id: &str) {
        if let Some(pending) = self
            .approvals
            .pending
            .iter_mut()
            .find(|pending| pending.card.run_id == job_id && pending.card.request.request_id == id)
        {
            pending.responding = false;
        }
    }

    fn notify_approval(&self, name: &str) {
        let name: String = name.chars().filter(|character| !character.is_control()).collect();
        let title = format!("AI Guild · {name}");
        let body = locale::pick([
            "チャットで操作の許可を待っています。",
            "An operation is waiting for your approval in chat.",
            "有操作正在聊天中等待你的批准。",
            "有操作正在聊天中等待你的核准。",
            "채팅에서 작업 승인을 기다리고 있습니다.",
        ]);
        let notifications = self.ports.notifications.clone();
        self.ports.spawner.spawn(Box::pin(async move {
            if let Err(error) = notifications.submit_ephemeral(&title, body) {
                log::warn!("Could not submit the operation approval notification: {error}");
            }
        }));
    }
}
