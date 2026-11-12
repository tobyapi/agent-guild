//! チャンネルのアイコン: 0002 の移行で列が足され、0001 の DB の既存のチャンネルは空（# のまま）で開ける。

use std::fs;
use std::sync::Arc;

use guild_application::ports::ChannelRepository;
use guild_domain::ids::ChannelId;
use rusqlite::{params, Connection};

use super::channels_messages::lobby;
use super::{memory, temp_dir};
use crate::infrastructure::sqlite::migrations::{self, APPLICATION_ID};
use crate::infrastructure::sqlite::{Database, SqliteChannelRepository};

/// 0001 だけを当てた（配布済みの版が作った）データベースに、チャンネルを1つ入れる
fn version_one_database(path: &std::path::Path) {
    let conn = Connection::open(path).unwrap();
    conn.pragma_update(None, "application_id", APPLICATION_ID).unwrap();
    conn.execute_batch("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)").unwrap();
    conn.execute_batch(include_str!("../migrations/0001_init.sql")).unwrap();
    conn.pragma_update(None, "user_version", 1).unwrap();
    conn.execute("INSERT INTO meta (key, value) VALUES ('schema_fingerprint', ?1)", [migrations::fingerprint(1)])
        .unwrap();
    conn.execute(
        "INSERT INTO channels (id, name, topic, created_at, is_lobby, workspace_json) VALUES (?1, ?2, '', 1, 1, ?3)",
        params!["c1", "ロビー", r#"{"mode":"shared","folder":null,"revision":0,"afterSeq":0}"#],
    )
    .unwrap();
}

#[test]
fn an_old_database_gets_the_icon_column_and_keeps_its_channels() {
    let dir = temp_dir("icon-upgrade");
    let path = dir.join("guild.db");
    version_one_database(&path);
    let db = Arc::new(Database::open(&path).unwrap());
    let channels = SqliteChannelRepository::new(db.clone());
    let old = channels.get(&ChannelId::new("c1")).unwrap().unwrap();
    assert_eq!((old.name.as_str(), old.icon.as_str()), ("ロビー", ""));
    channels.update(&guild_domain::channel::Channel { icon: "🏠".to_owned(), ..old }).unwrap();
    drop((channels, db));
    let conn = Connection::open(&path).unwrap();
    assert_eq!(migrations::applied_version(&conn).unwrap(), migrations::latest_version());
    drop(conn);
    let reopened = Arc::new(Database::open(&path).unwrap());
    let saved = SqliteChannelRepository::new(reopened.clone()).list().unwrap();
    assert_eq!(saved[0].icon, "🏠");
    drop(reopened);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn icons_are_saved_on_insert_and_update() {
    let channels = SqliteChannelRepository::new(memory());
    channels.insert(&guild_domain::channel::Channel { icon: "🎨".to_owned(), ..lobby() }).unwrap();
    assert_eq!(channels.get(&ChannelId::new("c1")).unwrap().unwrap().icon, "🎨");
    channels.update(&lobby()).unwrap();
    assert_eq!(channels.list().unwrap()[0].icon, "");
}
