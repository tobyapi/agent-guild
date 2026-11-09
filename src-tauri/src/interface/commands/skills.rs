//! スキルとスキルライブラリのコマンド。

use guild_domain::ids::{AgentId, SkillId};
use guild_domain::skill::{LibraryAddMode, Skill, SkillInput, SkillLibrary};
use tauri::State;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

/// linked のスキルは SKILL.md を読み直した内容（読めなければ problem に理由）
#[tauri::command]
pub async fn list_skills(state: State<'_, AppState>, agent_id: AgentId) -> CommandResult<Vec<Skill>> {
    state.services()?.skills.list(&agent_id).map_err(reject)
}

/// id が null なら新規。name は変換せずに検証する。linked は編集できない
#[tauri::command]
pub async fn save_skill(state: State<'_, AppState>, input: SkillInput) -> CommandResult<Skill> {
    state.services()?.skills.save(input).map_err(reject)
}

/// linked なら参照を外すだけ（元のフォルダは消さない）
#[tauri::command]
pub async fn delete_skill(state: State<'_, AppState>, id: SkillId) -> CommandResult<()> {
    state.services()?.skills.delete(&id).map_err(reject)
}

/// 呼ぶたびにライブラリのフォルダを走査し直す
#[tauri::command]
pub async fn get_skill_library(state: State<'_, AppState>) -> CommandResult<SkillLibrary> {
    state.services()?.library.get().map_err(reject)
}

/// settings.json に保存して skill-library-changed を出す
#[tauri::command]
pub async fn set_skill_library_dirs(state: State<'_, AppState>, dirs: Vec<String>) -> CommandResult<SkillLibrary> {
    state.services()?.library.set_dirs(&dirs).map_err(reject)
}

#[tauri::command]
pub async fn add_library_skill(
    state: State<'_, AppState>,
    agent_id: AgentId,
    path: String,
    mode: LibraryAddMode,
) -> CommandResult<Skill> {
    state.services()?.library.add(&agent_id, &path, mode).map_err(reject)
}

/// OS のファイラでフォルダを開く
#[tauri::command]
pub async fn reveal_skill_folder(state: State<'_, AppState>, path: String) -> CommandResult<()> {
    state.services()?.library.reveal(&path).map_err(reject)
}
