use guild_domain::run_limits::RunLimits;
use tauri::State;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

#[tauri::command]
pub async fn get_run_limits(state: State<'_, AppState>) -> CommandResult<RunLimits> {
    state.services()?.conversation.run_limits().await.map_err(reject)
}

#[tauri::command]
pub async fn set_run_limits(state: State<'_, AppState>, limits: RunLimits) -> CommandResult<()> {
    state.services()?.conversation.set_run_limits(limits).await.map_err(reject)
}
