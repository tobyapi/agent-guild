//! エージェントのコマンド。

use guild_domain::agent::{Agent, AgentInput};
use guild_domain::ids::AgentId;
use tauri::State;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

#[tauri::command]
pub async fn create_agent(state: State<'_, AppState>, input: AgentInput) -> CommandResult<Agent> {
    state.services()?.agents.create(input).map_err(reject)
}

#[tauri::command]
pub async fn update_agent(state: State<'_, AppState>, id: AgentId, input: AgentInput) -> CommandResult<Agent> {
    state.services()?.agents.update(&id, input).map_err(reject)
}

#[tauri::command]
pub async fn delete_agent(state: State<'_, AppState>, id: AgentId) -> CommandResult<()> {
    state.services()?.agents.delete(&id).await.map_err(reject)
}

/// 自発活動を今すぐ1回積む
#[tauri::command]
pub async fn run_autonomous(state: State<'_, AppState>, agent_id: AgentId) -> CommandResult<()> {
    state.services()?.autonomy.run_now(&agent_id).map_err(reject)
}

/// OS のファイラで作業場所を開く
#[tauri::command]
pub async fn open_agent_workspace(state: State<'_, AppState>, agent_id: AgentId) -> CommandResult<()> {
    state.services()?.agents.open_workspace(&agent_id).map_err(reject)
}
