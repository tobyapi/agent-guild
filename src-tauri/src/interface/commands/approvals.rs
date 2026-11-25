use guild_domain::ids::ChannelId;
use guild_domain::operation_approval::{ApprovalDecision, OperationApproval};
use tauri::State;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

#[tauri::command]
pub async fn list_operation_approvals(
    state: State<'_, AppState>,
    channel_id: ChannelId,
) -> CommandResult<Vec<OperationApproval>> {
    Ok(state.services()?.conversation.list_operation_approvals(channel_id).await)
}

#[tauri::command]
pub async fn respond_to_operation_approval(
    state: State<'_, AppState>,
    channel_id: ChannelId,
    request_id: String,
    decision: ApprovalDecision,
) -> CommandResult<bool> {
    state.services()?.conversation.respond_to_operation_approval(channel_id, request_id, decision).await.map_err(reject)
}
