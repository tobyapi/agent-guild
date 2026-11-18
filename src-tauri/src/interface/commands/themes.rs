use super::{reject, CommandResult};
use crate::interface::state::AppState;
use tauri::State;
#[tauri::command]
pub async fn generate_theme(
    state: State<'_, AppState>,
    request_id: String,
    backend_id: String,
    subject: String,
) -> CommandResult<String> {
    state.services()?.theme_generation.generate(&request_id, &backend_id, &subject).await.map_err(reject)
}
#[tauri::command]
pub async fn cancel_theme_generation(state: State<'_, AppState>, request_id: String) -> CommandResult<()> {
    state.services()?.theme_generation.cancel(&request_id).await.map_err(reject)
}
