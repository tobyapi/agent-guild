//! アプリの外で開くもの: 発言の Markdown のリンクを OS の既定のブラウザで開く（http・https だけ。復旧モードでも動く）。

use guild_application::AppError;
use guild_domain::link::external_url;
use guild_domain::locale;

use super::{reject, CommandResult};

#[tauri::command]
pub async fn open_url(url: String) -> CommandResult<()> {
    let url = external_url(&url).map_err(|error| reject(error.into()))?;
    tauri_plugin_opener::open_url(&url, None::<&str>).map_err(|error| {
        reject(AppError::Internal(locale::pick([
            format!("ブラウザでリンクを開けませんでした（{error}）"),
            format!("Could not open the link in the browser ({error})"),
            format!("无法在浏览器中打开链接（{error}）"),
            format!("無法在瀏覽器中開啟連結（{error}）"),
            format!("브라우저에서 링크를 열 수 없습니다({error})"),
        ])))
    })
}
