//! チャンネル（メンバーの順序・追加・除外・削除）と発言（seq とページング）の往復。

use guild_application::ports::{ChannelRepository, MessageFilter, MessageRepository};
use guild_domain::attachment::Attachment;
use guild_domain::author::{Author, MemberId};
use guild_domain::channel::Channel;
use guild_domain::ids::{AgentId, AttachmentId, ChannelId, DelegationId, MessageId};
use guild_domain::message::{MessageKind, NewMessage};

use super::memory;
use crate::infrastructure::sqlite::{SqliteChannelRepository, SqliteMessageRepository};

pub(super) fn lobby() -> Channel {
    Channel {
        workspace: Default::default(),
        is_lobby: false,
        id: ChannelId::new("c1"),
        name: "ロビー".to_owned(),
        topic: "雑談".to_owned(),
        icon: String::new(),
        member_ids: vec![MemberId::Human, MemberId::Agent(AgentId::new("b")), MemberId::Agent(AgentId::new("a"))],
        created_at: 1,
    }
}

fn new_message(id: &str, content: &str) -> NewMessage {
    NewMessage {
        id: MessageId::new(id),
        channel_id: ChannelId::new("c1"),
        author_id: Author::Agent(AgentId::new("a")),
        content: content.to_owned(),
        attachments: vec![Attachment {
            id: AttachmentId::new(format!("{id}-a1")),
            name: "screen.png".to_owned(),
            media_type: "image/png".to_owned(),
            size: 3,
        }],
        kind: MessageKind::Chat,
        mentions: vec![AgentId::new("b")],
        reply_to_id: Some(MessageId::new("m0")),
        root_id: MessageId::new("m0"),
        depth: 2,
        delegation_id: Some(DelegationId::new("d1")),
        created_at: 100,
    }
}

#[test]
fn channels_keep_members_in_join_order() {
    let db = memory();
    let repository = SqliteChannelRepository::new(db);
    let mut channel = lobby();
    repository.insert(&channel).unwrap();
    assert_eq!(repository.get(&channel.id).unwrap(), Some(channel.clone()));

    let newcomer = MemberId::Agent(AgentId::new("c"));
    repository.add_member(&channel.id, &newcomer).unwrap();
    repository.add_member(&channel.id, &newcomer).unwrap();
    repository.remove_member(&channel.id, &MemberId::Agent(AgentId::new("b"))).unwrap();
    channel.name = "広場".to_owned();
    repository.update(&channel).unwrap();
    let stored = repository.list().unwrap();
    assert_eq!(stored.len(), 1);
    assert_eq!(stored[0].name, "広場");
    assert_eq!(stored[0].member_ids, vec![MemberId::Human, MemberId::Agent(AgentId::new("a")), newcomer.clone()]);

    repository.remove_member_everywhere(&newcomer).unwrap();
    assert!(!repository.get(&channel.id).unwrap().unwrap().has_member(&newcomer));
}

#[test]
fn messages_get_increasing_seq_and_page_backwards() {
    let db = memory();
    SqliteChannelRepository::new(db.clone()).insert(&lobby()).unwrap();
    let repository = SqliteMessageRepository::new(db);
    let first = repository.insert(new_message("m1", "一つ目")).unwrap();
    let second = repository.insert(new_message("m2", "二つ目")).unwrap();
    let third = repository.insert(new_message("m3", "三つ目")).unwrap();
    assert!(first.seq < second.seq && second.seq < third.seq);

    let channel = ChannelId::new("c1");
    assert_eq!(repository.list(&channel, MessageFilter::All, None, 2).unwrap(), vec![second.clone(), third]);
    assert_eq!(repository.list(&channel, MessageFilter::All, Some(second.seq), 50).unwrap(), vec![first.clone()]);
    assert_eq!(first.mentions, vec![AgentId::new("b")]);
    assert_eq!(first.reply_to_id, Some(MessageId::new("m0")));
    assert_eq!(first.attachments[0].name, "screen.png", "添付のメタデータも保存する");
    assert_eq!(repository.get(&MessageId::new("m2")).unwrap(), Some(second));
    assert_eq!(repository.get(&MessageId::new("nope")).unwrap(), None);
}

#[test]
fn messages_of_conversations_are_the_latest_within_the_limit() {
    let db = memory();
    SqliteChannelRepository::new(db.clone()).insert(&lobby()).unwrap();
    let repository = SqliteMessageRepository::new(db);
    let in_root = |id: &str, root: &str| NewMessage { root_id: MessageId::new(root), ..new_message(id, id) };
    let a1 = repository.insert(in_root("a1", "a1")).unwrap();
    let b1 = repository.insert(in_root("b1", "b1")).unwrap();
    let a2 = repository.insert(in_root("a2", "a1")).unwrap();
    let a3 = repository.insert(in_root("a3", "a1")).unwrap();
    let channel = ChannelId::new("c1");
    let list =
        |roots: &[MessageId], limit| repository.list_in_conversations(&channel, roots, MessageFilter::All, limit);
    assert_eq!(list(&[MessageId::new("a1")], 2).unwrap(), vec![a2.clone(), a3.clone()]);
    assert_eq!(list(&[MessageId::new("a1"), MessageId::new("b1")], 10).unwrap(), vec![a1, b1, a2, a3]);
    assert!(list(&[], 10).unwrap().is_empty());
}

#[test]
fn progress_posts_can_be_left_out_or_listed_alone() {
    let db = memory();
    SqliteChannelRepository::new(db.clone()).insert(&lobby()).unwrap();
    let repository = SqliteMessageRepository::new(db);
    let progress = |id: &str| NewMessage { kind: MessageKind::Progress, ..new_message(id, id) };
    let reply1 = repository.insert(new_message("r1", "返答1")).unwrap();
    let post1 = repository.insert(progress("p1")).unwrap();
    let post2 = repository.insert(progress("p2")).unwrap();
    let reply2 = repository.insert(new_message("r2", "返答2")).unwrap();
    let channel = ChannelId::new("c1");
    let roots = [MessageId::new("m0")];
    let (without, only) = (MessageFilter::WithoutProgress, MessageFilter::ProgressOnly);
    assert_eq!(repository.list(&channel, without, None, 2).unwrap(), vec![reply1.clone(), reply2.clone()]);
    assert_eq!(repository.list(&channel, only, None, 1).unwrap(), vec![post2.clone()]);
    assert_eq!(repository.list_in_conversations(&channel, &roots, without, 10).unwrap(), vec![reply1, reply2]);
    assert_eq!(repository.list_in_conversations(&channel, &roots, only, 10).unwrap(), vec![post1, post2]);
}

#[test]
fn deleting_a_channel_removes_its_members_and_messages() {
    let db = memory();
    let channels = SqliteChannelRepository::new(db.clone());
    channels.insert(&lobby()).unwrap();
    let messages = SqliteMessageRepository::new(db);
    messages.insert(new_message("m1", "消える発言")).unwrap();
    channels.delete(&ChannelId::new("c1")).unwrap();
    assert!(channels.list().unwrap().is_empty());
    assert!(messages.list(&ChannelId::new("c1"), MessageFilter::All, None, 50).unwrap().is_empty());
}
