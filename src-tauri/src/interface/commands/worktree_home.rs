use guild_domain::worktree_home::WorktreeHome;
use tauri::State;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

#[tauri::command]
pub async fn get_worktree_home(state: State<'_, AppState>) -> CommandResult<WorktreeHome> {
    state.services()?.worktree_home.get().map_err(reject)
}

#[tauri::command]
pub async fn set_worktree_home(state: State<'_, AppState>, path: Option<String>) -> CommandResult<()> {
    state.services()?.worktree_home.set(path).map_err(reject)
}
