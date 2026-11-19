//! Filesystem adapter for local files referenced by messages.

use super::local_files::{self, FileCheckError};
use guild_application::local_files::{LocalFileAccess, LocalImage};
use guild_application::{AppError, AppResult};
use guild_domain::ids::AgentId;
use guild_domain::locale;
use std::path::PathBuf;

pub struct FsLocalFiles(pub PathBuf);

impl LocalFileAccess for FsLocalFiles {
    fn open_link(&self, path: &str, reveal: bool) -> AppResult<()> {
        super::local_link::open(path, reveal)
    }
    fn reveal(&self, path: &str, agent_id: Option<&AgentId>) -> AppResult<()> {
        let path =
            local_files::resolve(path, agent_id, &self.0).ok_or_else(|| AppError::validation(unsupported_path()))?;
        let path = local_files::canonical_file(&path).map_err(|error| match error {
            FileCheckError::NotFound => AppError::NotFound(local_file()),
            FileCheckError::Unsupported => AppError::validation(unsupported_path()),
        })?;
        super::file_manager::reveal_file(&path).map_err(|error| AppError::Storage(error.to_string()))
    }
    fn read_image(&self, path: &str, agent_id: Option<&AgentId>) -> LocalImage {
        let Some(path) = local_files::resolve(path, agent_id, &self.0) else {
            return LocalImage::Unsupported;
        };
        local_files::read_image(&path)
    }
}

pub(super) fn local_file() -> &'static str {
    locale::pick(["ローカルファイル", "Local file", "本地文件", "本機檔案", "로컬 파일"])
}
pub(super) fn unsupported_path() -> &'static str {
    locale::pick([
        "このローカルファイルのパスは使えません",
        "This local file path cannot be used",
        "无法使用此本地文件路径",
        "無法使用這個本機檔案路徑",
        "이 로컬 파일 경로를 사용할 수 없습니다",
    ])
}
