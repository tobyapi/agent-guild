//! スキーマが変わったデバッグビルド用: 古い DB ファイル一式を `guild.db.bak-<日時>` に退避する。

use std::ffi::OsString;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// SQLite が DB ファイルの隣に置く補助ファイル
const SIDE_FILES: [&str; 2] = ["-wal", "-shm"];

/// `path` とその -wal / -shm を `<path>.bak-<日時>`（と -wal / -shm）へ移し、退避先を返す
pub(super) fn move_aside(path: &Path, timestamp: &str) -> io::Result<PathBuf> {
    let backup = with_suffix(path, &format!(".bak-{timestamp}"));
    fs::rename(path, &backup)?;
    for side in SIDE_FILES {
        let from = with_suffix(path, side);
        if from.exists() {
            fs::rename(&from, with_suffix(&backup, side))?;
        }
    }
    Ok(backup)
}

fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut name = OsString::from(path.as_os_str());
    name.push(suffix);
    PathBuf::from(name)
}
