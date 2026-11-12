//! アイコンの枠のコマンド（生成・取り消し・画像の読み出し・削除）。

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use guild_domain::frame::CustomFrame;
use tauri::State;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

/// 説明から枠の画像を1枚描いてもらい、検査して整えて保存する（返事を待つ。最長5分）
#[tauri::command]
pub async fn generate_avatar_frame(
    state: State<'_, AppState>,
    backend_id: String,
    description: String,
    name: String,
) -> CommandResult<CustomFrame> {
    let frames = state.services()?.frames.clone();
    frames.generate(&backend_id, &description, &name).await.map_err(reject)
}

/// 生成中の枠を取り消す（生成のコマンドは runtime の失敗で終わる）
#[tauri::command]
pub async fn cancel_avatar_frame_generation(state: State<'_, AppState>) -> CommandResult<()> {
    state.services()?.frames.cancel_generation().await;
    Ok(())
}

/// 画像の枠（kind が png）の絵を data URL で返す（img にそのまま渡せる。CSP の img-src は data: を許している）
#[tauri::command]
pub async fn get_frame_image(state: State<'_, AppState>, id: String) -> CommandResult<String> {
    let bytes = state.services()?.frames.image(&id).map_err(reject)?;
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
}

/// 生成した枠を消す（選んでいたメンバーは枠なしに戻る）
#[tauri::command]
pub async fn delete_avatar_frame(state: State<'_, AppState>, id: String) -> CommandResult<()> {
    state.services()?.frames.delete(&id).map_err(reject)
}
