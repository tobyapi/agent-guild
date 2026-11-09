//! 人間のプロフィールのコマンド。

use guild_domain::profile::Profile;
use tauri::State;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

#[tauri::command]
pub async fn update_profile(state: State<'_, AppState>, profile: Profile) -> CommandResult<Profile> {
    state.services()?.profile.update(profile).map_err(reject)
}
