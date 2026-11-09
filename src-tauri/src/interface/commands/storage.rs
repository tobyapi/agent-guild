//! 保存先のコマンド（復旧モードでも動く）。

use guild_domain::storage::{DataDirMode, StorageInfo};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use tokio::sync::oneshot;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

#[tauri::command]
pub async fn get_storage_info(state: State<'_, AppState>) -> CommandResult<StorageInfo> {
    Ok(state.storage().info())
}

/// OS のフォルダ選択（キャンセルなら null）。ダイアログの結果はコールバックで届くので oneshot で待つ
#[tauri::command]
pub async fn choose_folder(app: AppHandle) -> CommandResult<Option<String>> {
    let (sender, receiver) = oneshot::channel();
    app.dialog().file().pick_folder(move |folder| {
        let _ = sender.send(folder);
    });
    let folder = receiver.await.ok().flatten();
    Ok(folder.and_then(|folder| folder.into_path().ok()).map(|path| path.display().to_string()))
}

/// 成功するとアプリが再起動する
#[tauri::command]
pub async fn change_data_dir(state: State<'_, AppState>, path: String, mode: DataDirMode) -> CommandResult<()> {
    state.storage().change_data_dir(&path, mode).await.map_err(reject)
}

#[tauri::command]
pub async fn reveal_data_dir(state: State<'_, AppState>) -> CommandResult<()> {
    state.storage().reveal().map_err(reject)
}
