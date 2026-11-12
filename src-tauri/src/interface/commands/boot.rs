//! 起動の結果と再起動（復旧モードでも動く）。

use guild_application::language::LanguageService;
use guild_domain::boot::BootStatus;
use tauri::{AppHandle, State};

use super::{reject, CommandResult};
use crate::interface::state::AppState;

/// 言語は起動のあとで変わりうるので、settings.json から読み直す（読めなければ起動時のもの）
#[tauri::command]
pub async fn get_boot_status(
    state: State<'_, AppState>,
    language: State<'_, LanguageService>,
) -> CommandResult<BootStatus> {
    let boot = state.boot().clone();
    Ok(match language.saved() {
        Ok(saved) => boot.with_language(saved),
        Err(_) => boot,
    })
}

/// 初回起動の初期設定を終えた（settings.json に印を書く。名前・スキルのフォルダ・保存先はそれぞれのコマンドで保存する）
#[tauri::command]
pub async fn complete_setup(state: State<'_, AppState>) -> CommandResult<()> {
    state.storage().complete_setup().map_err(reject)
}

/// 終了処理（ランナーの shutdown など）を経てからアプリを起動し直す
#[tauri::command]
pub async fn restart_app(app: AppHandle) -> CommandResult<()> {
    app.request_restart();
    Ok(())
}
