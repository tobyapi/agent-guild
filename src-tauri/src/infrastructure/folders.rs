//! 保存先の候補の調査とファイラ（Folders の実装）: 書き込めるか・空か・ギルドのデータフォルダか・いまの場所との関係。

use std::fs;
use std::path::{Path, PathBuf};

use guild_application::ports::{FolderState, Folders, TargetFolder};
use guild_application::{AppError, AppResult};

use guild_domain::locale;

use super::data_dir::{is_empty_folder, read_marker, MarkerState, DB_FILE};
use super::file_manager;
use super::sqlite::{inspect_database, OpenError};

const WRITE_PROBE: &str = ".guild-write-test";

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
        fs::create_dir_all(dir).map_err(|e| {
            AppError::validation(locale::pick([
                format!("フォルダを作れません（{e}）"),
                format!("Cannot create the folder ({e})"),
                format!("无法创建文件夹（{e}）"),
                format!("無法建立資料夾（{e}）"),
                format!("폴더를 만들 수 없습니다({e})"),
            ]))
        })?;
        let probe = dir.join(WRITE_PROBE);
        fs::write(&probe, b"ok").and_then(|()| fs::remove_file(&probe)).map_err(|e| {
            AppError::validation(locale::pick([
                format!("このフォルダには書き込めません（{e}）"),
                format!("Cannot write to this folder ({e})"),
                format!("无法写入此文件夹（{e}）"),
                format!("無法寫入此資料夾（{e}）"),
                format!("이 폴더에는 쓸 수 없습니다({e})"),
            ]))
        })?;
        Ok(TargetFolder {
            state: folder_state(dir)?,
            is_current: same(dir, &self.current),
            is_nested: nested(dir, &self.current),
            is_default: same(dir, &self.default),
        })
    }

    fn reveal(&self, dir: &Path) -> AppResult<()> {
        file_manager::reveal(dir).map_err(|e| {
            AppError::Storage(locale::pick([
                format!("フォルダを開けませんでした（{e}）"),
                format!("Could not open the folder ({e})"),
                format!("无法打开文件夹（{e}）"),
                format!("無法開啟資料夾（{e}）"),
                format!("폴더를 열 수 없습니다({e})"),
            ]))
        })
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
        MarkerState::Newer(_) => FolderState::IncompatibleGuild(newer_data()),
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
        Err(OpenError::Newer(_)) => FolderState::IncompatibleGuild(newer_data()),
        Err(error) => FolderState::IncompatibleGuild(error.to_string()),
    }
}

fn newer_data() -> String {
    locale::pick([
        "新しい版の AIギルドで保存されたデータです。アプリを更新してください",
        "This data was saved by a newer version of AI Guild. Update the app",
        "此数据由较新版本的 AI 公会保存。请更新应用",
        "此資料由較新版本的 AI 公會儲存。請更新應用程式",
        "새 버전의 AI 길드로 저장된 데이터입니다. 앱을 업데이트하십시오",
    ])
    .to_owned()
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
