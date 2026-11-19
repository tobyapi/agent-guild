use super::channels_messages::{lobby, member_database};
use crate::infrastructure::sqlite::SqliteChannelRepository;
use guild_application::ports::ChannelRepository;
use guild_domain::author::MemberId;

#[test]
fn membership_and_lobby_constraints_reject_invalid_writes() {
    let db = member_database();
    let repo = SqliteChannelRepository::new(db);
    let mut ch = lobby();
    ch.is_lobby = true;
    repo.insert(&ch).unwrap();
    for member in ["system", "missing"] {
        assert!(repo.add_member(&ch.id, &MemberId::from(member.to_owned())).is_err());
    }
    ch.id = guild_domain::ids::ChannelId::new("other");
    assert!(repo.insert(&ch).is_err());
    assert_eq!(repo.list().unwrap().len(), 1);
}
