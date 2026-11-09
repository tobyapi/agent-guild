//! OS のファイラでフォルダを開く（Windows は explorer、macOS は open、それ以外は xdg-open）。
//! ファイルはそれを選んだ状態で開く（Windows は explorer /select、macOS は open -R、それ以外はフォルダを開く）。

use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

/// フォルダを開く。ファイラの終了は待たない
pub fn reveal(path: &Path) -> io::Result<()> {
    opener(&native(path)).spawn().map(drop)
}

/// ファイルを選んだ状態でファイラを開く。ファイラの終了は待たない
pub fn reveal_file(path: &Path) -> io::Result<()> {
    selector(&native(path)).spawn().map(drop)
}

#[cfg(target_os = "windows")]
fn selector(path: &Path) -> Command {
    use std::os::windows::process::CommandExt;
    let mut command = Command::new("explorer");
    // explorer は「/select,"パス"」をそのまま読む（std の引数の引用の付け方では解釈されない）
    command.raw_arg(format!("/select,\"{}\"", path.display()));
    command
}

#[cfg(target_os = "macos")]
fn selector(path: &Path) -> Command {
    let mut command = Command::new("open");
    command.arg("-R").arg(path);
    command
}

#[cfg(all(unix, not(target_os = "macos")))]
fn selector(path: &Path) -> Command {
    opener(path.parent().unwrap_or(path))
}

#[cfg(target_os = "windows")]
fn opener(path: &Path) -> Command {
    let mut command = Command::new("explorer");
    command.arg(path);
    command
}

#[cfg(target_os = "macos")]
fn opener(path: &Path) -> Command {
    let mut command = Command::new("open");
    command.arg(path);
    command
}

#[cfg(all(unix, not(target_os = "macos")))]
fn opener(path: &Path) -> Command {
    let mut command = Command::new("xdg-open");
    command.arg(path);
    command
}

/// explorer は "/" 区切りのパスを解釈できないので、Windows では "\" に直す
fn native(path: &Path) -> PathBuf {
    if cfg!(windows) {
        PathBuf::from(path.to_string_lossy().replace('/', "\\"))
    } else {
        path.to_path_buf()
    }
}
