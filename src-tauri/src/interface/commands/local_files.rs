//! Local file commands use the application service supplied at bootstrap.
use super::{reject, CommandResult};
use guild_application::local_files::{LocalFileService, LocalImage};
use guild_domain::ids::AgentId;
use tauri::State;

#[tauri::command]
pub async fn reveal_local_file(
    files: State<'_, LocalFileService>,
    path: String,
    agent_id: Option<AgentId>,
) -> CommandResult<()> {
    files.reveal(&path, agent_id.as_ref()).map_err(reject)
}

#[tauri::command]
pub async fn read_local_image(
    files: State<'_, LocalFileService>,
    path: String,
    agent_id: Option<AgentId>,
) -> CommandResult<LocalImage> {
    Ok(files.read_image(&path, agent_id.as_ref()))
}
