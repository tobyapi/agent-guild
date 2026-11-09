//! 今のデータの書き出し（保存先の変更の copy）。

use std::fs;
use std::sync::Arc;

use guild_application::ports::{DataExporter, Folders};
use guild_application::AppError;
use guild_application::ports::FolderState;

use super::TempDir;
use crate::infrastructure::data_dir::{read_marker, MarkerState};
use crate::infrastructure::export::DataExport;
use crate::infrastructure::folders::FsFolders;
use crate::infrastructure::sqlite::Database;

fn current_data(dir: &TempDir) -> Arc<Database> {
    let work = dir.0.join("agents").join("a1").join("work");
    fs::create_dir_all(&work).unwrap();
    fs::write(work.join("MEMORY.md"), "人間はコーヒー派").unwrap();
    Arc::new(Database::open(&dir.0.join("guild.db")).unwrap())
}

#[test]
fn copies_the_database_workspaces_and_marker() {
    let source = TempDir::new("source");
    let exporter = DataExport::new(current_data(&source), source.0.clone());
    let target = TempDir::new("target");
    exporter.export_to(&target.0).unwrap();

    assert!(target.0.join("guild.db").exists());
    assert!(!target.0.join("guild.db.tmp").exists() && !target.0.join("agents.tmp").exists());
    let memory = fs::read_to_string(target.0.join("agents").join("a1").join("work").join("MEMORY.md")).unwrap();
    assert_eq!(memory, "人間はコーヒー派");
    assert_eq!(read_marker(&target.0), MarkerState::Valid);
    let folders = FsFolders::new(source.0.clone(), source.0.clone());
    assert_eq!(folders.inspect(&target.0).unwrap().state, FolderState::Guild, "そのまま開けるデータになる");
    assert!(source.0.join("agents").exists(), "元のデータは消さない");
}

#[test]
fn a_failed_export_removes_what_it_made() {
    let source = TempDir::new("source");
    let exporter = DataExport::new(current_data(&source), source.0.clone());
    let target = TempDir::new("target");
    // DB と agents/ を書き出したあと、guild-data.json を書くところで失敗させる（同じ名前のフォルダで塞ぐ）
    fs::create_dir_all(target.0.join("guild-data.json")).unwrap();

    let result = exporter.export_to(&target.0);

    assert!(matches!(result, Err(AppError::Storage(_))));
    for leftover in ["guild.db.tmp", "agents.tmp", "agents", "guild.db"] {
        assert!(!target.0.join(leftover).exists(), "{leftover} が残っている");
    }
}
