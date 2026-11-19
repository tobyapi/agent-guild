use super::channels_messages::{lobby, member_database};
use crate::infrastructure::sqlite::SqliteChannelRepository;
use guild_application::ports::ChannelRepository;
use guild_domain::ids::ChannelId;

#[test]
fn icons_are_saved_on_insert_and_update() {
    let channels = SqliteChannelRepository::new(member_database());
    channels.insert(&guild_domain::channel::Channel { icon: "🎨".to_owned(), ..lobby() }).unwrap();
    assert_eq!(channels.get(&ChannelId::new("c1")).unwrap().unwrap().icon, "🎨");
    channels.update(&lobby()).unwrap();
    assert_eq!(channels.list().unwrap()[0].icon, "");
}
