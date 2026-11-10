//! 全体像とバックエンドの再確認・アプリからのログイン。

use guild_domain::snapshot::Snapshot;
use tauri::State;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

#[tauri::command]
pub async fn backend_api_key(
    state: State<'_, AppState>,
    backend_id: String,
    action: String,
    key: Option<String>,
) -> CommandResult<String> {
    state.services()?.backends.api_key(&backend_id, &action, key.as_deref()).await.map_err(reject)
}

#[tauri::command]
pub async fn get_snapshot(state: State<'_, AppState>) -> CommandResult<Snapshot> {
    state.services()?.snapshot.get().map_err(reject)
}

/// ランナーの確認結果を待つ。失敗・応答待ち超過は呼び出し元へ返す。
#[tauri::command]
pub async fn refresh_backends(state: State<'_, AppState>) -> CommandResult<()> {
    state.services()?.backends.refresh().await.map_err(reject)
}

#[tauri::command]
pub async fn install_backend_cli(state: State<'_, AppState>, backend_id: String) -> CommandResult<()> {
    state.services()?.backends.install_cli(&backend_id).await.map_err(reject)
}

#[tauri::command]
pub async fn start_ollama(state: State<'_, AppState>) -> CommandResult<()> {
    state.services()?.backends.start_ollama().await.map_err(reject)
}

/// バックエンドのログインを始め、利用者が終える（窓が閉じる）まで待つ。終わった後の状態は state-changed で届く
#[tauri::command]
pub async fn login_backend(state: State<'_, AppState>, backend_id: String) -> CommandResult<()> {
    state.services()?.backends.login(&backend_id).await.map_err(reject)
}
