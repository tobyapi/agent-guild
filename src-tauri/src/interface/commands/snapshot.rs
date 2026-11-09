//! 全体像とバックエンドの再確認・アプリからのログイン。

use guild_domain::snapshot::Snapshot;
use tauri::State;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

#[tauri::command]
pub async fn get_snapshot(state: State<'_, AppState>) -> CommandResult<Snapshot> {
    state.services()?.snapshot.get().map_err(reject)
}

/// ランナーに probe を送る（結果は state-changed で届く）
#[tauri::command]
pub async fn refresh_backends(state: State<'_, AppState>) -> CommandResult<()> {
    state.services()?.backends.refresh().await;
    Ok(())
}

/// バックエンドのログインを始め、利用者が終える（窓が閉じる）まで待つ。終わった後の状態は state-changed で届く
#[tauri::command]
pub async fn login_backend(state: State<'_, AppState>, backend_id: String) -> CommandResult<()> {
    state.services()?.backends.login(&backend_id).await.map_err(reject)
}
