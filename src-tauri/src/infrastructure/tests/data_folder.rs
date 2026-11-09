//! データフォルダの印・ロックと、保存先の候補の調査。

use std::fs;
use std::time::Duration;

use guild_application::ports::{FolderState, Folders};

use super::TempDir;
use crate::infrastructure::data_dir::{
    acquire_lock, is_empty_folder, read_marker, write_marker, LockError, MarkerState, LOCK_FILE,
};
use crate::infrastructure::folders::FsFolders;
use crate::infrastructure::sqlite::Database;

#[test]
fn the_marker_identifies_guild_data() {
    let dir = TempDir::new("marker");
    assert_eq!(read_marker(&dir.0), MarkerState::Missing);
    write_marker(&dir.0).unwrap();
    assert_eq!(read_marker(&dir.0), MarkerState::Valid);
    fs::write(dir.0.join("guild-data.json"), r#"{ "app": "other", "layoutVersion": 1 }"#).unwrap();
    assert_eq!(read_marker(&dir.0), MarkerState::Foreign);
    fs::write(dir.0.join("guild-data.json"), r#"{ "app": "agent-guild", "layoutVersion": 9 }"#).unwrap();
    assert_eq!(read_marker(&dir.0), MarkerState::Newer(9));
    fs::write(dir.0.join("guild-data.json"), "壊れた").unwrap();
    assert!(matches!(read_marker(&dir.0), MarkerState::Unreadable(_)));
}

#[test]
fn a_folder_with_only_the_lock_counts_as_empty() {
    let dir = TempDir::new("empty");
    assert!(is_empty_folder(&dir.0.join("missing")).unwrap());
    fs::write(dir.0.join(LOCK_FILE), "").unwrap();
    assert!(is_empty_folder(&dir.0).unwrap());
    fs::write(dir.0.join("notes.txt"), "メモ").unwrap();
    assert!(!is_empty_folder(&dir.0).unwrap());
}

#[test]
fn the_lock_is_exclusive_while_held() {
    let dir = TempDir::new("lock");
    let held = acquire_lock(&dir.0, Duration::ZERO).unwrap();
    assert!(matches!(acquire_lock(&dir.0, Duration::from_millis(250)), Err(LockError::Busy)));
    drop(held);
    assert!(acquire_lock(&dir.0, Duration::ZERO).is_ok());
}

#[test]
fn inspect_reports_empty_guild_and_foreign_folders() {
    let current = TempDir::new("current");
    let folders = FsFolders::new(current.0.clone(), current.0.clone());
    let target = TempDir::new("target");

    let empty = folders.inspect(&target.0).unwrap();
    assert_eq!(empty.state, FolderState::Empty);
    assert!(!empty.is_current && !empty.is_nested && !empty.is_default);
    assert!(is_empty_folder(&target.0).unwrap(), "書き込みの確認に使ったファイルは残さない");

    write_marker(&target.0).unwrap();
    drop(Database::open(&target.0.join("guild.db")).unwrap());
    assert_eq!(folders.inspect(&target.0).unwrap().state, FolderState::Guild);

    let foreign = TempDir::new("foreign");
    fs::write(foreign.0.join("photo.jpg"), "写真").unwrap();
    assert_eq!(folders.inspect(&foreign.0).unwrap().state, FolderState::Foreign);
}

#[test]
fn inspect_flags_the_current_nested_and_default_folders() {
    let current = TempDir::new("current");
    let default = TempDir::new("default");
    let folders = FsFolders::new(current.0.clone(), default.0.clone());
    assert!(folders.inspect(&current.0).unwrap().is_current);
    assert!(folders.inspect(&current.0.join("inner")).unwrap().is_nested);
    assert!(folders.inspect(&default.0).unwrap().is_default);
}
