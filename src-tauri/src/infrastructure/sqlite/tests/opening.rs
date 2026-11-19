//! 開くときの判定: 新規・既存・他のアプリの DB・新しすぎる DB・壊れたファイル・指紋の不一致・書き出し。

use std::fs;
use std::sync::Arc;

use guild_application::ports::AgentRepository;
use rusqlite::Connection;

use super::{saved_agent, temp_dir};
use crate::infrastructure::sqlite::schema::{APPLICATION_ID, VERSION};
use crate::infrastructure::sqlite::{inspect_database, Database, OpenError, SqliteAgentRepository};

fn header(path: &std::path::Path) -> (i32, i64) {
    let conn = Connection::open(path).unwrap();
    (
        conn.query_row("PRAGMA application_id", [], |r| r.get(0)).unwrap(),
        conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap(),
    )
}

#[test]
fn a_new_database_gets_the_application_id_and_schema() {
    let dir = temp_dir("new");
    let path = dir.join("guild.db");
    let db = Arc::new(Database::open(&path).unwrap());
    saved_agent(&db, "a1", "ハル", 1);
    drop(db);
    assert_eq!(header(&path), (APPLICATION_ID, VERSION));
    let reopened = Arc::new(Database::open(&path).unwrap());
    assert_eq!(SqliteAgentRepository::new(reopened.clone()).list().unwrap().len(), 1, "既存のデータを開ける");
    assert!(inspect_database(&path).is_ok());
    drop(reopened);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn refuses_databases_of_other_apps_and_newer_versions() {
    let dir = temp_dir("refuse");
    let foreign = dir.join("foreign.db");
    Connection::open(&foreign).unwrap().execute_batch("CREATE TABLE notes (body TEXT);").unwrap();
    assert!(matches!(Database::open(&foreign), Err(OpenError::Foreign)));
    assert!(matches!(inspect_database(&foreign), Err(OpenError::Foreign)));

    let newer = dir.join("newer.db");
    let conn = Connection::open(&newer).unwrap();
    conn.pragma_update(None, "application_id", APPLICATION_ID).unwrap();
    conn.pragma_update(None, "user_version", 99).unwrap();
    drop(conn);
    assert!(matches!(Database::open(&newer), Err(OpenError::Newer(99))));
    assert_eq!(header(&newer), (APPLICATION_ID, 99), "新しすぎる DB には書き込まない");
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn reports_a_broken_file_as_corrupt() {
    let dir = temp_dir("corrupt");
    let path = dir.join("guild.db");
    fs::write(&path, "これは SQLite ではありません。".repeat(100)).unwrap();
    assert!(matches!(Database::open(&path), Err(OpenError::Corrupt(_))));
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_changed_schema_is_refused_without_replacing_the_database() {
    let dir = temp_dir("outdated");
    let path = dir.join("guild.db");
    drop(Database::open(&path).unwrap());
    Connection::open(&path).unwrap().execute_batch("CREATE TABLE extra(x)").unwrap();
    let before = fs::read(&path).unwrap();
    assert!(matches!(Database::open(&path), Err(OpenError::Corrupt(_))));
    assert_eq!(before, fs::read(&path).unwrap());
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn export_writes_a_consistent_copy() {
    let dir = temp_dir("export");
    let db = Arc::new(Database::open(&dir.join("guild.db")).unwrap());
    saved_agent(&db, "a1", "ハル", 1);
    let copy = dir.join("copy.db");
    db.export_to(&copy).unwrap();
    assert_eq!(header(&copy), (APPLICATION_ID, VERSION));
    let copied = Arc::new(Database::open(&copy).unwrap());
    assert_eq!(SqliteAgentRepository::new(copied.clone()).list().unwrap()[0].name, "ハル");
    drop((db, copied));
    fs::remove_dir_all(dir).unwrap();
}
