//! アプリの更新（design.md「アプリの更新」。復旧モードでも動く）: 新しい版の確認と、ダウンロード → 署名の検証 → 入れ替え → 再起動。
//! 配布元と公開鍵は tauri.conf.json の plugins.updater。署名の合わない配布物はプラグインが入れずに失敗にする。

use guild_application::AppError;
use guild_domain::update::{AvailableUpdate, UpdateStatus};
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

use super::{reject, CommandResult};
use crate::interface::state::BeforeUpdate;

/// 新しい版があるかを配布元に確かめる
#[tauri::command]
pub async fn check_update(app: AppHandle) -> CommandResult<UpdateStatus> {
    let latest = find_update(&app)
        .await?
        .map(|update| AvailableUpdate { version: update.version, notes: update.body.unwrap_or_default() });
    Ok(UpdateStatus { current_version: app.package_info().version.to_string(), latest })
}

/// 新しい版を入れて起動し直す。Windows はインストーラーに任せてアプリを終える（インストーラーが起動し直す）ので戻らない
#[tauri::command]
pub async fn install_update(app: AppHandle, before: State<'_, BeforeUpdate>) -> CommandResult<()> {
    let Some(update) = find_update(&app).await? else {
        return Err(reject(AppError::Conflict("新しい版はありません。いまの版が最新です".to_owned())));
    };
    log::info!("更新を入れます: {} → {}", update.current_version, update.version);
    let bytes =
        update.download(|_, _| {}, || {}).await.map_err(|error| failed("更新をダウンロードできませんでした", error))?;
    // 入れ替えの前に、同梱の Node.js で動くランナーを止める（動いたままだとファイルを置き換えられない）
    before.run().await;
    update.install(bytes).map_err(|error| failed("更新を入れられませんでした。アプリを起動し直してください", error))?;
    app.request_restart();
    Ok(())
}

async fn find_update(app: &AppHandle) -> CommandResult<Option<Update>> {
    let updater = app.updater().map_err(|error| failed("更新を確認できませんでした", error))?;
    updater.check().await.map_err(|error| failed("更新を確認できませんでした", error))
}

fn failed(what: &str, error: impl std::fmt::Display) -> guild_domain::error::CommandError {
    reject(AppError::Unavailable(format!("{what}（{error}）")))
}
