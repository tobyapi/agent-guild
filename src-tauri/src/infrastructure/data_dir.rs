//! データフォルダの構成（design.md §11）: guild-data.json（ギルドのデータである印）と .lock（多重起動防止）。
//!   <dataDir>/guild-data.json  { "app": "agent-guild", "layoutVersion": 1 }
//!   <dataDir>/guild.db・.lock・agents/<agentId>/{work,state}/・attachments/<channelId>/（発言に貼った画像）

use std::fs::{self, File, OpenOptions, TryLockError};
use std::io;
use std::path::Path;
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

pub const MARKER_FILE: &str = "guild-data.json";
pub const DB_FILE: &str = "guild.db";
pub const LOCK_FILE: &str = ".lock";
pub const AGENTS_DIR: &str = "agents";
pub const ATTACHMENTS_DIR: &str = "attachments";
const APP: &str = "agent-guild";
pub const LAYOUT_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Marker {
    app: String,
    layout_version: u32,
}

/// 印の状態
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MarkerState {
    /// この版で使える
    Valid,
    /// 印がない
    Missing,
    /// 他のアプリの印
    Foreign,
    /// 新しい版の構成
    Newer(u32),
    /// 読めない（日本語の理由）
    Unreadable(String),
}

/// 印を読む
pub fn read_marker(dir: &Path) -> MarkerState {
    let text = match fs::read_to_string(dir.join(MARKER_FILE)) {
        Ok(text) => text,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return MarkerState::Missing,
        Err(error) => return MarkerState::Unreadable(error.to_string()),
    };
    match serde_json::from_str::<Marker>(&text) {
        Ok(marker) if marker.app != APP => MarkerState::Foreign,
        Ok(marker) if marker.layout_version > LAYOUT_VERSION => MarkerState::Newer(marker.layout_version),
        Ok(_) => MarkerState::Valid,
        Err(error) => MarkerState::Unreadable(format!("{MARKER_FILE} を読めません: {error}")),
    }
}

pub fn write_marker(dir: &Path) -> io::Result<()> {
    let marker = Marker { app: APP.to_owned(), layout_version: LAYOUT_VERSION };
    let text = serde_json::to_string_pretty(&marker).map_err(io::Error::other)?;
    fs::write(dir.join(MARKER_FILE), text)
}

/// .lock 以外に何もない（または存在しない）フォルダか
pub fn is_empty_folder(dir: &Path) -> io::Result<bool> {
    match fs::read_dir(dir) {
        Ok(entries) => {
            for entry in entries {
                if entry?.file_name() != LOCK_FILE {
                    return Ok(false);
                }
            }
            Ok(true)
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(true),
        Err(error) => Err(error),
    }
}

/// データフォルダの排他ロック。持っている間（プロセスが生きている間）だけ有効
pub struct DataDirLock {
    _file: File,
}

#[derive(Debug)]
pub enum LockError {
    /// 他のプロセスが使っている
    Busy,
    /// .lock を作れない
    Io(io::Error),
}

/// .lock を取る。再起動の重なりに備えて wait まで再試行する
pub fn acquire_lock(dir: &Path, wait: Duration) -> Result<DataDirLock, LockError> {
    let file =
        OpenOptions::new().create(true).truncate(false).write(true).open(dir.join(LOCK_FILE)).map_err(LockError::Io)?;
    let deadline = Instant::now() + wait;
    loop {
        match file.try_lock() {
            Ok(()) => return Ok(DataDirLock { _file: file }),
            Err(TryLockError::WouldBlock) if Instant::now() < deadline => thread::sleep(Duration::from_millis(100)),
            Err(TryLockError::WouldBlock) => return Err(LockError::Busy),
            Err(TryLockError::Error(error)) => return Err(LockError::Io(error)),
        }
    }
}
