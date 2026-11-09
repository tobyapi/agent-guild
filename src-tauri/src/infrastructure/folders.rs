//! 保存先の候補の調査とファイラ（Folders の実装）: 書き込めるか・空か・ギルドのデータフォルダか・いまの場所との関係。

use std::fs;
use std::path::{Path, PathBuf};

use guild_application::ports::{FolderState, Folders, TargetFolder};
use guild_application::{AppError, AppResult};

use super::data_dir::{is_empty_folder, read_marker, MarkerState, DB_FILE};
use super::file_manager;
use super::sqlite::{inspect_database, OpenError};

const WRITE_PROBE: &str = ".guild-write-test";
const NEWER_DATA: &str = "新しい版の AIギルドで保存されたデータです。アプリを更新してください";

pub struct FsFolders {
    current: PathBuf,
    default: PathBuf,
}

impl FsFolders {
    /// current はいまのデータフォルダ、default は既定のデータフォルダ
    pub fn new(current: PathBuf, default: PathBuf) -> Self {
        Self { current, default }
    }
}

impl Folders for FsFolders {
    fn inspect(&self, dir: &Path) -> AppResult<TargetFolder> {
        fs::create_dir_all(dir).map_err(|e| AppError::validation(format!("フォルダを作れません（{e}）")))?;
        let probe = dir.join(WRITE_PROBE);
        fs::write(&probe, b"ok")
            .and_then(|()| fs::remove_file(&probe))
            .map_err(|e| AppError::validation(format!("このフォルダには書き込めません（{e}）")))?;
        Ok(TargetFolder {
            state: folder_state(dir)?,
            is_current: same(dir, &self.current),
            is_nested: nested(dir, &self.current),
            is_default: same(dir, &self.default),
        })
    }

    fn reveal(&self, dir: &Path) -> AppResult<()> {
        file_manager::reveal(dir).map_err(|e| AppError::Storage(format!("フォルダを開けませんでした（{e}）")))
    }
}

fn folder_state(dir: &Path) -> AppResult<FolderState> {
    let empty = is_empty_folder(dir).map_err(|e| AppError::Storage(e.to_string()))?;
    if empty {
        return Ok(FolderState::Empty);
    }
    Ok(match read_marker(dir) {
        MarkerState::Valid => database_state(dir),
        MarkerState::Missing | MarkerState::Foreign => FolderState::Foreign,
        MarkerState::Newer(_) => FolderState::IncompatibleGuild(NEWER_DATA.to_owned()),
        MarkerState::Unreadable(reason) => FolderState::IncompatibleGuild(reason),
    })
}

/// 印のあるフォルダの guild.db を書き込まずに調べる（まだ DB がなければ開ける）
fn database_state(dir: &Path) -> FolderState {
    let db = dir.join(DB_FILE);
    if !db.exists() {
        return FolderState::Guild;
    }
    match inspect_database(&db) {
        Ok(()) => FolderState::Guild,
        Err(OpenError::Newer(_)) => FolderState::IncompatibleGuild(NEWER_DATA.to_owned()),
        Err(error) => FolderState::IncompatibleGuild(error.to_string()),
    }
}

fn canonical(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn same(a: &Path, b: &Path) -> bool {
    canonical(a) == canonical(b)
}

/// 互いに入れ子（同じ場所は含まない）
fn nested(a: &Path, b: &Path) -> bool {
    let (a, b) = (canonical(a), canonical(b));
    a != b && (a.starts_with(&b) || b.starts_with(&a))
}
