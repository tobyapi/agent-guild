//! ギルドのプロフィール（名前と紋）のコマンド。

use guild_domain::guild::GuildProfile;
use tauri::State;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

#[tauri::command]
pub async fn update_guild(state: State<'_, AppState>, guild: GuildProfile) -> CommandResult<GuildProfile> {
    state.services()?.guild.update(guild).map_err(reject)
}
