use tauri::State;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

#[tauri::command]
pub async fn get_global_instructions(state: State<'_, AppState>) -> CommandResult<String> {
    state.services()?.global_instructions.get().map_err(reject)
}

#[tauri::command]
pub async fn set_global_instructions(state: State<'_, AppState>, instructions: String) -> CommandResult<()> {
    state.services()?.global_instructions.set(instructions).map_err(reject)
}
