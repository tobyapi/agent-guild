//! 起動の結果と再起動（復旧モードでも動く）。

use guild_domain::boot::BootStatus;
use tauri::{AppHandle, State};

use super::CommandResult;
use crate::interface::state::AppState;

#[tauri::command]
pub async fn get_boot_status(state: State<'_, AppState>) -> CommandResult<BootStatus> {
    Ok(state.boot().clone())
}

/// 終了処理（ランナーの shutdown など）を経てからアプリを起動し直す
#[tauri::command]
pub async fn restart_app(app: AppHandle) -> CommandResult<()> {
    app.request_restart();
    Ok(())
}
