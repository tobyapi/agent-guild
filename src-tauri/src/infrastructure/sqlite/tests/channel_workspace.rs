use super::memory;
use crate::infrastructure::sqlite::SqliteChannelRepository;
use guild_application::ports::ChannelRepository;

#[test]
fn workspace_assignment_round_trips_and_preserves_the_channel() {
    use guild_domain::channel::{ChannelWorkspace, WorkspaceMode};
    let repository = SqliteChannelRepository::new(memory());
    let mut channel = super::channels_messages::lobby();
    repository.insert(&channel).unwrap();
    channel.workspace = ChannelWorkspace {
        mode: WorkspaceMode::Folder,
        folder: Some("/project".to_owned()),
        revision: 7,
        after_seq: 42,
    };
    repository.set_workspace(&channel.id, &channel.workspace).unwrap();
    let mut stale = channel.clone();
    stale.workspace = Default::default();
    repository.update(&stale).unwrap();
    assert_eq!(repository.get(&channel.id).unwrap(), Some(channel.clone()));
    assert_eq!(repository.list().unwrap(), vec![channel]);
}
