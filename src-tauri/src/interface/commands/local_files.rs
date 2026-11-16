//! 発言本文に書かれたローカル画像の読み込みと、ファイラでの表示。

use std::path::PathBuf;

use guild_application::AppError;
use guild_domain::ids::AgentId;
use guild_domain::locale;
use tauri::State;

use super::{reject, CommandResult};
use crate::infrastructure::file_manager;
use crate::infrastructure::local_files::{self, FileCheckError, LocalImage};
use crate::interface::state::AppState;

#[tauri::command]
pub async fn reveal_local_file(
    state: State<'_, AppState>,
    path: String,
    agent_id: Option<AgentId>,
) -> CommandResult<()> {
    let path = resolve(&state, &path, agent_id.as_ref())?;
    let path = local_files::canonical_file(&path).map_err(|error| match error {
        FileCheckError::NotFound => reject(AppError::NotFound(local_file())),
        FileCheckError::Unsupported => reject(AppError::validation(unsupported_path())),
    })?;
    file_manager::reveal_file(&path).map_err(|error| reject(AppError::Storage(error.to_string())))
}

#[tauri::command]
pub async fn read_local_image(
    state: State<'_, AppState>,
    path: String,
    agent_id: Option<AgentId>,
) -> CommandResult<LocalImage> {
    let data_dir = PathBuf::from(&state.boot().data_dir);
    let Some(path) = local_files::resolve(&path, agent_id.as_ref(), &data_dir) else {
        return Ok(LocalImage::Unsupported);
    };
    Ok(local_files::read_image(&path))
}

fn resolve(state: &State<'_, AppState>, path: &str, agent_id: Option<&AgentId>) -> CommandResult<std::path::PathBuf> {
    let data_dir = PathBuf::from(&state.boot().data_dir);
    local_files::resolve(path, agent_id, &data_dir).ok_or_else(|| reject(AppError::validation(unsupported_path())))
}

fn local_file() -> &'static str {
    locale::pick(["ローカルファイル", "Local file", "本地文件", "本機檔案", "로컬 파일"])
}

fn unsupported_path() -> &'static str {
    locale::pick([
        "このローカルファイルのパスは使えません",
        "This local file path cannot be used",
        "无法使用此本地文件路径",
        "無法使用這個本機檔案路徑",
        "이 로컬 파일 경로를 사용할 수 없습니다",
    ])
}
