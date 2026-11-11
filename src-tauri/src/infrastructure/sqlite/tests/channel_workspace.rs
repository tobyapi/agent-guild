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

#[test]
fn migration_0005_preserves_existing_channels_and_defaults_to_legacy() {
    use crate::infrastructure::sqlite::migrations::migrate;
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    for sql in [
        include_str!("../migrations/0001_init.sql"),
        include_str!("../migrations/0002_run_measurements.sql"),
        include_str!("../migrations/0003_skill_source.sql"),
        include_str!("../migrations/0004_lobby.sql"),
    ] {
        conn.execute_batch(sql).unwrap();
    }
    conn.pragma_update(None, "user_version", 4).unwrap();
    conn.execute(
        "INSERT INTO channels (id, name, topic, created_at, is_lobby) VALUES ('old', '既存', '話題', 123, 1)",
        [],
    )
    .unwrap();
    migrate(&conn).unwrap();
    let actual: (String, String, i64, bool, String) = conn
        .query_row("SELECT name, topic, created_at, is_lobby, workspace_json FROM channels WHERE id = 'old'", [], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
        })
        .unwrap();
    assert_eq!((&actual.0, &actual.1, actual.2, actual.3), (&"既存".to_owned(), &"話題".to_owned(), 123, true));
    let workspace: guild_domain::channel::ChannelWorkspace = serde_json::from_str(&actual.4).unwrap();
    assert_eq!(workspace, Default::default());
    let count = conn.total_changes();
    migrate(&conn).unwrap();
    assert_eq!(count, conn.total_changes());
}

#[test]
fn database_open_upgrades_a_version_4_fixture_without_resetting_data() {
    use crate::infrastructure::sqlite::migrations::APPLICATION_ID;
    use crate::infrastructure::sqlite::{Database, SqliteChannelRepository};
    let dir = super::temp_dir("channel-upgrade-v4");
    let path = dir.join("fixture.db");
    let conn = rusqlite::Connection::open(&path).unwrap();
    conn.execute_batch("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)").unwrap();
    for sql in [
        include_str!("../migrations/0001_init.sql"),
        include_str!("../migrations/0002_run_measurements.sql"),
        include_str!("../migrations/0003_skill_source.sql"),
        include_str!("../migrations/0004_lobby.sql"),
    ] {
        conn.execute_batch(sql).unwrap();
    }
    conn.pragma_update(None, "application_id", APPLICATION_ID).unwrap();
    conn.pragma_update(None, "user_version", 4).unwrap();
    // Fingerprint of the unchanged 0001..0004 files in baseline 1e3f728.
    conn.execute("INSERT INTO meta VALUES ('schema_fingerprint', 'f08aecdf80871a39')", []).unwrap();
    conn.execute(
        "INSERT INTO channels (id, name, topic, created_at, is_lobby) VALUES ('old', '既存', '保持する話題', 123, 1)",
        [],
    )
    .unwrap();
    drop(conn);
    let db = std::sync::Arc::new(Database::open(&path).unwrap());
    let repository = SqliteChannelRepository::new(db.clone());
    let channel = repository.list().unwrap().pop().unwrap();
    assert_eq!(channel.name, "既存");
    assert_eq!(channel.topic, "保持する話題");
    assert_eq!(channel.created_at, 123);
    assert!(channel.is_lobby);
    assert_eq!(channel.workspace, Default::default());
    db.with(|c| c.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))).map(|v| assert_eq!(v, 5)).unwrap();
    assert!(!std::fs::read_dir(&dir).unwrap().any(|e| e.unwrap().file_name().to_string_lossy().contains(".bak-")));
    drop((repository, db));
    std::fs::remove_dir_all(dir).unwrap();
}
