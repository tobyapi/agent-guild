//! tasks ブロックからの割り振りの作成（§7.1-2）: 割り振りを保存して delegation-changed を出し、振り分けの結果に
//! 割り振れなかった名前のお知らせ・チャンネル外の担当者の参加・担当者の task ジョブを足す。

use guild_domain::conversation::{JobSpec, Notice, Routing, RoutingContext};
use guild_domain::delegation::{Delegation, DelegationStatus, Subtask, SubtaskStatus, TaskPlan};
use guild_domain::ids::{DelegationId, SubtaskId};
use guild_domain::message::{Message, NewMessage};

use crate::services::Ports;

/// サブタスクが1件以上あれば（id が Some なら）割り振りを作って返す
pub(super) fn prepare(ports: &Ports, reply: &NewMessage, plan: &TaskPlan) -> Option<Delegation> {
    if plan.tasks.is_empty() {
        return None;
    }
    let manager = reply.author_id.agent_id()?;
    let id = DelegationId::new(ports.ids.new_id());
    let now = ports.clock.now_ms();
    let subtasks = plan
        .tasks
        .iter()
        .map(|task| Subtask {
            id: SubtaskId::new(ports.ids.new_id()),
            assignee_id: task.assignee.clone(),
            instruction: task.instruction.clone(),
            status: SubtaskStatus::Pending,
            result_message_id: None,
            note: None,
        })
        .collect();
    Some(Delegation {
        id,
        channel_id: reply.channel_id.clone(),
        manager_id: manager.clone(),
        message_id: reply.id.clone(),
        status: DelegationStatus::Running,
        subtasks,
        summary_message_id: None,
        created_at: now,
        updated_at: now,
    })
}

pub(super) fn route(
    reply: &Message,
    plan: TaskPlan,
    delegation: Option<&Delegation>,
    ctx: &RoutingContext<'_>,
    routing: &mut Routing,
) {
    if !plan.unassignable.is_empty() {
        routing.notices.push(Notice::Unassignable(plan.unassignable));
    }
    if !plan.overflow.is_empty() {
        routing.notices.push(Notice::TooManyTasks(plan.overflow));
    }
    let Some(delegation) = delegation else { return };
    for subtask in &delegation.subtasks {
        let assignee = &subtask.assignee_id;
        if !ctx.channel.has_agent(assignee) && !routing.joins.contains(assignee) {
            routing.joins.push(assignee.clone());
        }
        routing.jobs.push(JobSpec::task(reply, delegation.subtask_ref(subtask)));
    }
}
