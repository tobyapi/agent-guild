//! アプリの外で開くもの: 発言の Markdown のリンクを OS の既定のブラウザで開く（http・https だけ。復旧モードでも動く）。

use guild_application::AppError;
use guild_domain::link::external_url;

use super::{reject, CommandResult};

#[tauri::command]
pub async fn open_url(url: String) -> CommandResult<()> {
    let url = external_url(&url).map_err(|error| reject(error.into()))?;
    tauri_plugin_opener::open_url(&url, None::<&str>)
        .map_err(|error| reject(AppError::Internal(format!("ブラウザでリンクを開けませんでした（{error}）"))))
}
