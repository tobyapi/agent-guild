//! データフォルダを開く手順（design.md §11 の 2〜5）と復旧モードの理由。

use std::fs;
use std::path::PathBuf;

use guild_domain::boot::BootReason;
use guild_domain::storage::StorageSource;

use super::TempDir;
use crate::bootstrap::boot::open;
use crate::bootstrap::paths::AppPaths;
use crate::infrastructure::data_dir::{read_marker, MarkerState};

fn paths(data_dir: PathBuf, source: StorageSource) -> AppPaths {
    AppPaths { config_dir: data_dir.clone(), default_data_dir: data_dir.clone(), data_dir, source, resource_dir: None }
}

fn reason(paths: &AppPaths) -> Option<BootReason> {
    open(paths).err().map(|status| status.reason)
}

#[test]
fn the_default_folder_is_created_and_marked() {
    let root = TempDir::new("default");
    let data = root.0.join("guild");
    let opened = open(&paths(data.clone(), StorageSource::Default)).unwrap();
    assert_eq!(read_marker(&data), MarkerState::Valid);
    assert!(data.join("guild.db").exists() && data.join(".lock").exists());
    drop(opened);
    assert!(open(&paths(data, StorageSource::Default)).is_ok(), "2回目も開ける");
}

#[test]
fn a_configured_folder_that_is_gone_means_missing() {
    let root = TempDir::new("missing");
    let gone = root.0.join("unplugged-drive");
    assert_eq!(reason(&paths(gone.clone(), StorageSource::Settings)), Some(BootReason::Missing));
    assert_eq!(reason(&paths(gone.clone(), StorageSource::Env)), Some(BootReason::Missing));
    assert!(!gone.exists(), "指定された場所は勝手に作らない");
}

#[test]
fn folders_of_other_apps_are_left_alone() {
    let root = TempDir::new("foreign");
    fs::write(root.0.join("report.docx"), "大事な書類").unwrap();
    assert_eq!(reason(&paths(root.0.clone(), StorageSource::Settings)), Some(BootReason::Foreign));
    assert!(!root.0.join("guild-data.json").exists() && !root.0.join("guild.db").exists());

    let other = TempDir::new("other-app");
    fs::write(other.0.join("guild-data.json"), r#"{ "app": "other", "layoutVersion": 1 }"#).unwrap();
    assert_eq!(reason(&paths(other.0.clone(), StorageSource::Settings)), Some(BootReason::Foreign));
}

#[test]
fn newer_or_broken_data_is_not_touched() {
    let newer = TempDir::new("newer");
    fs::write(newer.0.join("guild-data.json"), r#"{ "app": "agent-guild", "layoutVersion": 2 }"#).unwrap();
    assert_eq!(reason(&paths(newer.0.clone(), StorageSource::Settings)), Some(BootReason::NewerVersion));

    let broken = TempDir::new("broken");
    let data = broken.0.clone();
    drop(open(&paths(data.clone(), StorageSource::Settings)).unwrap());
    fs::write(data.join("guild.db"), "壊れたデータ".repeat(200)).unwrap();
    let _ = fs::remove_file(data.join("guild.db-wal"));
    let _ = fs::remove_file(data.join("guild.db-shm"));
    assert_eq!(reason(&paths(data, StorageSource::Settings)), Some(BootReason::Corrupt));
}
