//! Resolve a chat link once. Dispatch only the inspected, canonical target.
use super::{file_manager, local_volume};
use guild_application::{AppError, AppResult};
use std::{
    fs, io,
    path::{Path, PathBuf},
};

#[derive(Debug, PartialEq, Eq)]
pub(super) enum Action {
    OpenDocument,
    OpenFolder,
    ShowFile,
}

pub(super) fn open(path: &str, reveal: bool) -> AppResult<()> {
    let (path, action) = resolve(path, reveal)?;
    match action {
        Action::OpenDocument => {
            tauri_plugin_opener::open_path(&path, None::<&str>).map_err(|error| AppError::Storage(error.to_string()))
        }
        Action::OpenFolder => file_manager::reveal(&path).map_err(io_error),
        Action::ShowFile => file_manager::reveal_file(&path).map_err(io_error),
    }
}

pub(super) fn resolve(input: &str, reveal: bool) -> AppResult<(PathBuf, Action)> {
    let path = Path::new(input);
    if !valid_path(path) {
        return Err(unsupported());
    }
    #[cfg(windows)]
    if !local_volume::is_local(path) {
        return Err(unsupported());
    }
    let canonical = shell_path(path.canonicalize().map_err(io_error)?)?;
    let metadata = canonical.metadata().map_err(io_error)?;
    let action = if metadata.is_dir() {
        Action::OpenFolder
    } else if !metadata.is_file() {
        return Err(unsupported());
    } else if reveal || !document(path) || !document(&canonical) || executable(&metadata) {
        Action::ShowFile
    } else {
        Action::OpenDocument
    };
    Ok((canonical, action))
}

/// Return a shell-compatible path on a verified local volume.
pub(super) fn shell_path(canonical: PathBuf) -> AppResult<PathBuf> {
    #[cfg(windows)]
    let canonical = super::plain_path::plain_path(&canonical);
    if valid_path(&canonical) && local_volume::is_local(&canonical) {
        Ok(canonical)
    } else {
        Err(unsupported())
    }
}

fn document(path: &Path) -> bool {
    let extension = path.extension().and_then(|ext| ext.to_str()).unwrap_or_default();
    matches!(
        extension.to_ascii_lowercase().as_str(),
        "md" | "txt"
            | "log"
            | "json"
            | "csv"
            | "pdf"
            | "png"
            | "jpg"
            | "jpeg"
            | "gif"
            | "webp"
            | "bmp"
            | "tif"
            | "tiff"
    )
}

#[cfg(unix)]
fn executable(metadata: &fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    metadata.permissions().mode() & 0o111 != 0
}
#[cfg(not(unix))]
fn executable(_: &fs::Metadata) -> bool {
    false
}

fn valid_path(path: &Path) -> bool {
    let Some(text) = path.to_str() else { return false };
    if !path.is_absolute()
        || text.chars().any(char::is_control)
        || ["//", "\\\\", "/\\", "\\/"].iter().any(|prefix| text.starts_with(prefix))
    {
        return false;
    }
    #[cfg(windows)]
    {
        let Some(tail) = text.get(2..) else { return false };
        // Shell paths cannot unambiguously represent alternate streams or verbatim-only names.
        !tail.contains([':', '<', '>', '"', '|', '?', '*']) && tail.split(['/', '\\']).all(shell_component)
    }
    #[cfg(not(windows))]
    true
}

#[cfg(windows)]
fn shell_component(name: &str) -> bool {
    if name == "." || name == ".." {
        return true;
    }
    let stem = name.split('.').next().unwrap_or_default().trim_end_matches(' ').to_ascii_uppercase();
    let device_number = stem.strip_prefix("COM").or_else(|| stem.strip_prefix("LPT"));
    !name.ends_with(['.', ' '])
        && !matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$")
        && !matches!(device_number, Some("1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"))
}

fn io_error(error: io::Error) -> AppError {
    if error.kind() == io::ErrorKind::NotFound {
        AppError::NotFound(super::local_file_access::local_file())
    } else {
        AppError::Storage(error.to_string())
    }
}

fn unsupported() -> AppError {
    AppError::validation(super::local_file_access::unsupported_path())
}
