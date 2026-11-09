//! データフォルダを開く（design.md §11 の 2〜5）。どこかで失敗したら復旧モードの理由（BootStatus）を返す。
//! 2. 既定の場所なら作る（指定された場所が無ければ missing） 3. .lock を取る（5秒まで再試行。取れなければ locked）
//! 4. guild-data.json を確かめる（空なら作る） 5. DB を開いて移行を当てる

use std::fs;
use std::io;
use std::path::Path;
use std::time::Duration;

use guild_domain::boot::{BootReason, BootStatus};
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
        LockError::Busy => recovery(BootReason::Locked, dir, "データフォルダは別の AIギルドが使っています".to_owned()),
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
        let message =
            format!("データフォルダ {} が見つかりません。ドライブが接続されているか確認してください。", dir.display());
        return Err(recovery(BootReason::Missing, dir, message));
    }
    fs::create_dir_all(dir).map_err(|error| recovery(BootReason::NotWritable, dir, error.to_string()))
}

fn check_marker(dir: &Path) -> Result<(), BootStatus> {
    match read_marker(dir) {
        MarkerState::Valid => Ok(()),
        MarkerState::Missing => {
            let empty = is_empty_folder(dir).map_err(|error| io_failure(dir, &error))?;
            if !empty {
                return Err(recovery(BootReason::Foreign, dir, "AIギルド以外のファイルがあるフォルダです".to_owned()));
            }
            write_marker(dir).map_err(|error| io_failure(dir, &error))
        }
        MarkerState::Foreign => Err(recovery(BootReason::Foreign, dir, "別のアプリのデータフォルダです".to_owned())),
        MarkerState::Newer(version) => Err(recovery(
            BootReason::NewerVersion,
            dir,
            format!("新しい版の構成（layoutVersion {version}）のデータフォルダです"),
        )),
        MarkerState::Unreadable(reason) => Err(recovery(BootReason::Corrupt, dir, reason)),
    }
}

fn io_failure(dir: &Path, error: &io::Error) -> BootStatus {
    recovery(BootReason::NotWritable, dir, error.to_string())
}

fn recovery(reason: BootReason, dir: &Path, message: String) -> BootStatus {
    BootStatus::recovery(reason, dir.display().to_string(), message)
}
