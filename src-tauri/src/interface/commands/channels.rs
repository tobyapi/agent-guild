//! チャンネルとメンバーのコマンド。

use guild_domain::author::MemberId;
use guild_domain::channel::Channel;
use guild_domain::ids::ChannelId;
use tauri::State;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

/// 人間は常にメンバーに入る
#[tauri::command]
pub async fn create_channel(
    state: State<'_, AppState>,
    name: String,
    topic: String,
    member_ids: Vec<MemberId>,
) -> CommandResult<Channel> {
    state.services()?.channels.create(&name, &topic, &member_ids).map_err(reject)
}

#[tauri::command]
pub async fn update_channel(state: State<'_, AppState>, id: ChannelId, name: String, topic: String) -> CommandResult<Channel> {
    state.services()?.channels.update(&id, &name, &topic).map_err(reject)
}

#[tauri::command]
pub async fn delete_channel(state: State<'_, AppState>, id: ChannelId) -> CommandResult<()> {
    state.services()?.channels.delete(&id).await.map_err(reject)
}

#[tauri::command]
pub async fn add_channel_member(state: State<'_, AppState>, channel_id: ChannelId, member_id: MemberId) -> CommandResult<()> {
    state.services()?.channels.add_member(&channel_id, &member_id).map_err(reject)
}

#[tauri::command]
pub async fn remove_channel_member(
    state: State<'_, AppState>,
    channel_id: ChannelId,
    member_id: MemberId,
) -> CommandResult<()> {
    state.services()?.channels.remove_member(&channel_id, &member_id).await.map_err(reject)
}
