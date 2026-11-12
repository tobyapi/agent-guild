//! データフォルダを開く（design.md §11 の 2〜5）。どこかで失敗したら復旧モードの理由（BootStatus）を返す。
//! 2. 既定の場所なら作る（指定された場所が無ければ missing） 3. .lock を取る（5秒まで再試行。取れなければ locked）
//! 4. guild-data.json を確かめる（空なら作る） 5. DB を開いて移行を当てる
//! 復旧モードの理由の文面は、いまの言語（起動時に settings.json から決める）。

use std::fs;
use std::io;
use std::path::Path;
use std::time::Duration;

use guild_domain::boot::{BootReason, BootStatus};
use guild_domain::locale;
use guild_domain::storage::StorageSource;

use super::paths::AppPaths;
use crate::infrastructure::data_dir::{
    acquire_lock, is_empty_folder, read_marker, write_marker, DataDirLock, LockError, MarkerState, DB_FILE,
};
use crate::infrastructure::sqlite::{Database, OpenError};

/// 再起動の重なりに備えてロックを待つ上限
const LOCK_WAIT: Duration = Duration::from_secs(5);

pub struct OpenedData {
    pub database: Database,
    /// アプリが動いている間持ち続ける
    pub lock: DataDirLock,
}

pub fn open(paths: &AppPaths) -> Result<OpenedData, BootStatus> {
    let dir = &paths.data_dir;
    prepare_folder(dir, paths.source)?;
    let lock = acquire_lock(dir, LOCK_WAIT).map_err(|error| match error {
        LockError::Busy => recovery(BootReason::Locked, dir, in_use()),
        LockError::Io(error) => recovery(BootReason::NotWritable, dir, error.to_string()),
    })?;
    check_marker(dir)?;
    let database = Database::open(&dir.join(DB_FILE)).map_err(|error| {
        let reason = match error {
            OpenError::Foreign => BootReason::Foreign,
            OpenError::Newer(_) => BootReason::NewerVersion,
            OpenError::Corrupt(_) => BootReason::Corrupt,
        };
        recovery(reason, dir, error.to_string())
    })?;
    Ok(OpenedData { database, lock })
}

fn prepare_folder(dir: &Path, source: StorageSource) -> Result<(), BootStatus> {
    if dir.is_dir() {
        return Ok(());
    }
    if source != StorageSource::Default {
        return Err(recovery(BootReason::Missing, dir, missing(dir)));
    }
    fs::create_dir_all(dir).map_err(|error| recovery(BootReason::NotWritable, dir, error.to_string()))
}

fn check_marker(dir: &Path) -> Result<(), BootStatus> {
    match read_marker(dir) {
        MarkerState::Valid => Ok(()),
        MarkerState::Missing => {
            let empty = is_empty_folder(dir).map_err(|error| io_failure(dir, &error))?;
            if !empty {
                return Err(recovery(BootReason::Foreign, dir, foreign_files()));
            }
            write_marker(dir).map_err(|error| io_failure(dir, &error))
        }
        MarkerState::Foreign => Err(recovery(BootReason::Foreign, dir, other_app())),
        MarkerState::Newer(version) => Err(recovery(BootReason::NewerVersion, dir, newer_layout(version))),
        MarkerState::Unreadable(reason) => Err(recovery(BootReason::Corrupt, dir, reason)),
    }
}

fn in_use() -> String {
    locale::pick([
        "データフォルダは別の AIギルドが使っています",
        "The data folder is being used by another AI Guild",
        "数据文件夹正被另一个 AI 公会使用",
        "資料資料夾正被另一個 AI 公會使用",
        "데이터 폴더를 다른 AI 길드가 사용하고 있습니다",
    ])
    .to_owned()
}

fn missing(dir: &Path) -> String {
    let dir = dir.display();
    locale::pick([
        format!("データフォルダ {dir} が見つかりません。ドライブが接続されているか確認してください。"),
        format!("The data folder {dir} was not found. Check that the drive is connected."),
        format!("找不到数据文件夹 {dir}。请确认驱动器已连接。"),
        format!("找不到資料資料夾 {dir}。請確認磁碟機已連接。"),
        format!("데이터 폴더 {dir}을(를) 찾을 수 없습니다. 드라이브가 연결되어 있는지 확인하세요."),
    ])
}

fn foreign_files() -> String {
    locale::pick([
        "AIギルド以外のファイルがあるフォルダです",
        "This folder contains files that are not from AI Guild",
        "此文件夹中有不属于 AI 公会的文件",
        "此資料夾中有不屬於 AI 公會的檔案",
        "AI 길드가 아닌 파일이 있는 폴더입니다",
    ])
    .to_owned()
}

fn other_app() -> String {
    locale::pick([
        "別のアプリのデータフォルダです",
        "This is another app's data folder",
        "这是其他应用的数据文件夹",
        "這是其他應用程式的資料資料夾",
        "다른 앱의 데이터 폴더입니다",
    ])
    .to_owned()
}

fn newer_layout(version: u32) -> String {
    locale::pick([
        format!("新しい版の構成（layoutVersion {version}）のデータフォルダです"),
        format!("This data folder uses a newer layout (layoutVersion {version})"),
        format!("此数据文件夹使用较新版本的结构（layoutVersion {version}）"),
        format!("此資料資料夾使用較新版本的結構（layoutVersion {version}）"),
        format!("더 새로운 버전의 구성(layoutVersion {version})을 사용하는 데이터 폴더입니다"),
    ])
}

fn io_failure(dir: &Path, error: &io::Error) -> BootStatus {
    recovery(BootReason::NotWritable, dir, error.to_string())
}

fn recovery(reason: BootReason, dir: &Path, message: String) -> BootStatus {
    BootStatus::recovery(reason, dir.display().to_string(), message)
}
