//! 旧設定を読み替えるだけで、保存値もユーザーの作業データも変更しない。
use super::memory;
use crate::infrastructure::sqlite::SqliteChannelRepository;
use guild_application::ports::ChannelRepository;
use guild_domain::channel::{ChannelWorkspace, WorkspaceMode};

#[test]
fn legacy_workspaces_load_as_shared_without_rewriting_saved_settings() {
    let cases: serde_json::Value =
        serde_json::from_str(include_str!("../../../../../contracts/behavior/channel-workspaces.json")).unwrap();
    for case in cases.as_array().unwrap() {
        let db = memory();
        let repository = SqliteChannelRepository::new(db.clone());
        let channel = super::channels_messages::lobby();
        repository.insert(&channel).unwrap();
        let original = case["saved"].to_string();
        db.with(|conn| conn.execute("UPDATE channels SET workspace_json = ?1", [&original])).unwrap();
        let expected: ChannelWorkspace = serde_json::from_value(case["loaded"].clone()).unwrap();
        let loaded = repository.get(&channel.id).unwrap().unwrap();
        assert_eq!(loaded.workspace, expected);
        assert_eq!(loaded.workspace.mode, WorkspaceMode::Shared);
        assert_eq!(loaded.workspace.folder, None);
        assert_eq!(repository.list().unwrap()[0], loaded);
        repository.update(&loaded).unwrap();
        let still_saved: String =
            db.with(|conn| conn.query_row("SELECT workspace_json FROM channels", [], |row| row.get(0))).unwrap();
        assert_eq!(still_saved, original, "read and unrelated updates must preserve the original settings");
    }
}
