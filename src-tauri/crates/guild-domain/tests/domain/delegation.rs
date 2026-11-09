//! 割り振りの決着の判定と状態遷移（§7.1-3〜7）、担当者の相談の連鎖へのサブタスクの引き継ぎ。

use guild_domain::conversation::{JobMode, JobSpec, Routing};
use guild_domain::delegation::{
    carry_subtask, judge, Delegation, DelegationStatus, Settlement, Subtask, SubtaskRef, SubtaskStatus, Turn, Verdict,
    ASSIGNEE_REMOVED, NO_ANSWER, RUN_FAILED, TIMED_OUT,
};
use guild_domain::ids::{AgentId, ChannelId, DelegationId, MessageId, SubtaskId};

use super::support::{by, ids, message};

fn delegation() -> Delegation {
    let subtask = |id: &str, assignee: &str| Subtask {
        id: SubtaskId::new(id),
        assignee_id: AgentId::new(assignee),
        instruction: format!("{assignee}への指示"),
        status: SubtaskStatus::Pending,
        result_message_id: None,
        note: None,
    };
    Delegation {
        id: DelegationId::new("d1"),
        channel_id: ChannelId::new("c1"),
        manager_id: AgentId::new("kaname"),
        message_id: MessageId::new("m1"),
        status: DelegationStatus::Running,
        subtasks: vec![subtask("s1", "haru"), subtask("s2", "sora")],
        summary_message_id: None,
        created_at: 0,
        updated_at: 0,
    }
}

fn target(subtask: &str, assignee: &str) -> SubtaskRef {
    SubtaskRef {
        delegation_id: DelegationId::new("d1"),
        subtask_id: SubtaskId::new(subtask),
        assignee_id: AgentId::new(assignee),
    }
}

#[test]
fn judging_waits_while_consulting_and_settles_otherwise() {
    let reply = MessageId::new("r1");
    assert_eq!(judge(Turn::Replied { message: &reply, continues: true }), Verdict::Waiting, "相談中は running のまま");
    assert_eq!(
        judge(Turn::Replied { message: &reply, continues: false }),
        Verdict::Settle(Settlement::Done(reply.clone()))
    );
    assert_eq!(judge(Turn::Passed), Verdict::Settle(Settlement::Failed { note: NO_ANSWER, message: None }));
    let error = MessageId::new("e1");
    let failed = Settlement::Failed { note: RUN_FAILED, message: Some(error.clone()) };
    assert_eq!(judge(Turn::Failed { error: &error }), Verdict::Settle(failed));
    let timed_out = Settlement::Failed { note: TIMED_OUT, message: Some(error.clone()) };
    assert_eq!(judge(Turn::TimedOut { error: &error }), Verdict::Settle(timed_out));
}

#[test]
fn subtasks_start_settle_and_the_delegation_reports_once_all_are_settled() {
    let mut delegation = delegation();
    assert!(delegation.start_subtask(&SubtaskId::new("s1"), 1));
    assert!(!delegation.start_subtask(&SubtaskId::new("s1"), 2), "running は二度始めない");
    assert!(delegation.settle_subtask(&SubtaskId::new("s1"), Settlement::Done(MessageId::new("r1")), 3));
    assert!(!delegation.begin_report(4), "未決着が残っている");
    let failed = Settlement::Failed { note: NO_ANSWER, message: None };
    assert!(delegation.settle_subtask(&SubtaskId::new("s2"), failed.clone(), 5), "pending からも決着できる");
    assert!(!delegation.settle_subtask(&SubtaskId::new("s2"), failed, 6), "決着は1回だけ");
    assert!(delegation.begin_report(7));
    assert_eq!((delegation.status, delegation.updated_at), (DelegationStatus::Reporting, 7));
    assert!(!delegation.begin_report(8), "reporting は1回だけ");
    assert_eq!(delegation.subtasks[0].result_message_id, Some(MessageId::new("r1")));
    assert_eq!(delegation.subtasks[1].note.as_deref(), Some(NO_ANSWER));
}

#[test]
fn the_report_finishes_the_delegation_once() {
    let mut cancelled = delegation();
    cancelled.cancel(0);
    assert!(!cancelled.finish(None, 1), "reporting でなければ終えない");
    let mut delegation = delegation();
    for id in ["s1", "s2"] {
        delegation.settle_subtask(&SubtaskId::new(id), Settlement::Done(MessageId::new(id)), 1);
    }
    assert!(delegation.begin_report(2));
    assert!(delegation.finish(Some(MessageId::new("summary")), 9));
    assert_eq!(delegation.status, DelegationStatus::Done);
    assert_eq!(delegation.summary_message_id, Some(MessageId::new("summary")));
    assert!(!delegation.cancel(10), "終わった割り振りは打ち切らない");
}

#[test]
fn cancelling_closes_open_subtasks_and_removed_assignees_fail() {
    let mut delegation = delegation();
    assert!(delegation.fail_assignee(&AgentId::new("sora"), 1));
    assert_eq!(delegation.subtasks[1].status, SubtaskStatus::Failed);
    assert_eq!(delegation.subtasks[1].note.as_deref(), Some(ASSIGNEE_REMOVED));
    assert!(!delegation.fail_assignee(&AgentId::new("sora"), 2), "決着済みは変えない");
    assert!(delegation.cancel(3));
    let statuses: Vec<SubtaskStatus> = delegation.subtasks.iter().map(|s| s.status).collect();
    assert_eq!(statuses, [SubtaskStatus::Cancelled, SubtaskStatus::Failed]);
    assert_eq!(delegation.status, DelegationStatus::Cancelled);
    assert!(!delegation.settle_subtask(&SubtaskId::new("s1"), Settlement::Done(MessageId::new("late")), 4));
}

#[test]
fn the_assignees_consultations_and_their_returns_carry_the_subtask() {
    let manager_reply = message(1, by("kaname"), "```tasks\n@ハル: 調べて\n```");
    let task = JobSpec::task(&manager_reply, target("s1", "haru"));
    assert_eq!((task.mode, task.depth, task.return_to.is_empty()), (JobMode::Task, 1, true));
    assert!(task.is_delegated());

    let haru_reply = message(2, by("haru"), "@ロジカ 見て");
    let consult = JobSpec::respond(AgentId::new("logica"), &haru_reply, JobMode::Reply, ids(&["haru"]));
    let mut routing = Routing { jobs: vec![consult], ..Routing::default() };
    carry_subtask(&task, &mut routing);
    assert_eq!(routing.jobs[0].subtask, Some(target("s1", "haru")), "担当者の相談は引き継ぐ");

    let logica_reply = message(3, by("logica"), "@ギア も見て");
    let back = JobSpec::respond(AgentId::new("haru"), &logica_reply, JobMode::Return, Vec::new());
    let deeper = JobSpec::respond(AgentId::new("gear"), &logica_reply, JobMode::Reply, ids(&["logica"]));
    let mut routing = Routing { jobs: vec![back, deeper], ..Routing::default() };
    carry_subtask(&consultation(), &mut routing);
    assert_eq!(routing.jobs[0].subtask, Some(target("s1", "haru")), "担当者に戻る return は引き継ぐ");
    assert_eq!(routing.jobs[1].subtask, None, "相談相手のさらに先の相談は引き継がない");
}

/// ロジカの相談ジョブ（ハルのサブタスクを持つ）
fn consultation() -> JobSpec {
    let haru_reply = message(2, by("haru"), "@ロジカ 見て");
    let mut job = JobSpec::respond(AgentId::new("logica"), &haru_reply, JobMode::Reply, ids(&["haru"]));
    job.subtask = Some(target("s1", "haru"));
    job
}
