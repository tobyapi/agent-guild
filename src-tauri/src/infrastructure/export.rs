//! 今のデータの書き出し（DataExporter の実装。design.md §11 の copy の手順）:
//! VACUUM INTO で guild.db.tmp → agents/・attachments/ をそれぞれ <名前>.tmp にコピーして rename → guild-data.json →
//! guild.db.tmp を rename（最後）。
//! 途中で失敗したら、移動先に作ったものを消してから Storage を返す（移動先は空のフォルダなので、中身はすべて自分が作ったもの）。

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use guild_application::ports::DataExporter;
use guild_application::{AppError, AppResult};

use super::data_dir::{write_marker, AGENTS_DIR, ATTACHMENTS_DIR, DB_FILE, MARKER_FILE};
use super::sqlite::Database;

const DB_TEMP: &str = "guild.db.tmp";
/// フォルダごと写すもの（作業フォルダと、発言に貼った画像）
const COPIED_DIRS: [&str; 2] = [AGENTS_DIR, ATTACHMENTS_DIR];

pub struct DataExport {
    db: Arc<Database>,
    data_dir: PathBuf,
}

impl DataExport {
    pub fn new(db: Arc<Database>, data_dir: PathBuf) -> Self {
        Self { db, data_dir }
    }

    fn export(&self, dir: &Path) -> Result<(), String> {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        let db_temp = dir.join(DB_TEMP);
        self.db.export_to(&db_temp).map_err(|e| e.to_string())?;
        for name in COPIED_DIRS {
            let from = self.data_dir.join(name);
            if from.exists() {
                let temp = dir.join(temp_name(name));
                copy_dir(&from, &temp).map_err(|e| format!("{name} フォルダをコピーできません: {e}"))?;
                fs::rename(&temp, dir.join(name)).map_err(|e| e.to_string())?;
            }
        }
        write_marker(dir).map_err(|e| e.to_string())?;
        fs::rename(&db_temp, dir.join(DB_FILE)).map_err(|e| e.to_string())
    }
}

impl DataExporter for DataExport {
    fn export_to(&self, dir: &Path) -> AppResult<()> {
        self.export(dir).map_err(|reason| {
            clean_up(dir);
            AppError::Storage(format!("データをコピーできませんでした: {reason}"))
        })
    }
}

fn temp_name(name: &str) -> String {
    format!("{name}.tmp")
}

fn copy_dir(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

/// 書き出しの途中で作ったものを消す（失敗しても続ける）
fn clean_up(dir: &Path) {
    for name in [DB_TEMP, DB_FILE, MARKER_FILE] {
        let _ = fs::remove_file(dir.join(name));
    }
    for name in COPIED_DIRS {
        let _ = fs::remove_dir_all(dir.join(temp_name(name)));
        let _ = fs::remove_dir_all(dir.join(name));
    }
}
