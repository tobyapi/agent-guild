//! 割り振りの往復: サブタスクの順・状態の更新・チャンネルごとの一覧・起動時の打ち切り・チャンネル削除での連鎖削除。

use guild_application::ports::{ChannelRepository, DelegationRepository};
use guild_domain::author::MemberId;
use guild_domain::channel::Channel;
use guild_domain::delegation::{Delegation, DelegationStatus, Settlement, Subtask, SubtaskStatus};
use guild_domain::ids::{AgentId, ChannelId, DelegationId, MessageId, SubtaskId};

use super::memory;
use crate::infrastructure::sqlite::{SqliteChannelRepository, SqliteDelegationRepository};

fn channel(id: &str) -> Channel {
    Channel {
        workspace: Default::default(),
        is_lobby: false,
        id: ChannelId::new(id),
        name: id.to_owned(),
        topic: String::new(),
        icon: String::new(),
        member_ids: vec![MemberId::Human],
        created_at: 1,
    }
}

fn delegation(id: &str, channel: &str, created_at: i64) -> Delegation {
    let subtask = |n: u32, assignee: &str| Subtask {
        id: SubtaskId::new(format!("{id}-s{n}")),
        assignee_id: AgentId::new(assignee),
        instruction: format!("{assignee}への指示\n2行目"),
        status: SubtaskStatus::Pending,
        result_message_id: None,
        note: None,
    };
    Delegation {
        id: DelegationId::new(id),
        channel_id: ChannelId::new(channel),
        manager_id: AgentId::new("kaname"),
        message_id: MessageId::new(format!("{id}-m")),
        status: DelegationStatus::Running,
        subtasks: vec![subtask(1, "sora"), subtask(2, "haru")],
        summary_message_id: None,
        created_at,
        updated_at: created_at,
    }
}

#[test]
fn delegations_round_trip_and_update_their_subtasks() {
    let db = memory();
    SqliteChannelRepository::new(db.clone()).insert(&channel("c1")).unwrap();
    let repository = SqliteDelegationRepository::new(db);
    let mut first = delegation("d1", "c1", 10);
    repository.insert(&first).unwrap();
    assert_eq!(repository.get(&first.id).unwrap(), Some(first.clone()), "サブタスクは書かれた順");

    first.start_subtask(&SubtaskId::new("d1-s1"), 11);
    first.settle_subtask(&SubtaskId::new("d1-s1"), Settlement::Done(MessageId::new("r1")), 12);
    first.settle_subtask(
        &SubtaskId::new("d1-s2"),
        Settlement::Failed { note: "回答がありませんでした", message: None },
        13,
    );
    first.begin_report(14);
    first.finish(Some(MessageId::new("summary")), 15);
    repository.update(&first).unwrap();
    assert_eq!(repository.get(&first.id).unwrap(), Some(first));
    assert_eq!(repository.get(&DelegationId::new("none")).unwrap(), None);
}

#[test]
fn listing_returns_the_newest_in_creation_order_and_unfinished_ones_are_cancelled_on_start() {
    let db = memory();
    let channels = SqliteChannelRepository::new(db.clone());
    channels.insert(&channel("c1")).unwrap();
    channels.insert(&channel("c2")).unwrap();
    let repository = SqliteDelegationRepository::new(db);
    for (id, created_at) in [("d1", 10), ("d2", 20), ("d3", 30)] {
        repository.insert(&delegation(id, "c1", created_at)).unwrap();
    }
    let mut finished = delegation("d4", "c2", 40);
    finished.cancel(41);
    repository.insert(&finished).unwrap();
    let listed: Vec<String> =
        repository.list(&ChannelId::new("c1"), 2).unwrap().iter().map(|d| d.id.to_string()).collect();
    assert_eq!(listed, ["d2", "d3"], "新しい方から2件を、作成順に");

    assert_eq!(repository.cancel_unfinished(99).unwrap(), 3, "終わっていない3件だけ");
    let cancelled = repository.get(&DelegationId::new("d1")).unwrap().unwrap();
    assert_eq!((cancelled.status, cancelled.updated_at), (DelegationStatus::Cancelled, 99));
    assert!(cancelled.subtasks.iter().all(|s| s.status == SubtaskStatus::Cancelled));
    assert_eq!(repository.get(&DelegationId::new("d4")).unwrap().unwrap().updated_at, 41, "終わったものは触らない");

    channels.delete(&ChannelId::new("c1")).unwrap();
    assert!(repository.list(&ChannelId::new("c1"), 200).unwrap().is_empty(), "チャンネルと一緒に消える");
    assert_eq!(repository.get(&DelegationId::new("d1")).unwrap(), None);
}
