//! アプリの更新（design.md「アプリの更新」。復旧モードでも動く）: 新しい版の確認と、ダウンロード → 署名の検証 → 入れ替え → 再起動。
//! 配布元と公開鍵は tauri.conf.json の plugins.updater。署名の合わない配布物はプラグインが入れずに失敗にする。

use guild_application::AppError;
use guild_domain::locale;
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
        return Err(reject(AppError::Conflict(
            locale::pick([
                "新しい版はありません。いまの版が最新です",
                "No new version is available. You are on the latest version",
                "没有新版本。当前版本已是最新",
                "沒有新版本。目前版本已是最新",
                "새 버전이 없습니다. 현재 버전이 최신입니다",
            ])
            .to_owned(),
        )));
    };
    log::info!("更新を入れます: {} → {}", update.current_version, update.version);
    let bytes = update.download(|_, _| {}, || {}).await.map_err(|error| {
        failed(
            [
                "更新をダウンロードできませんでした",
                "Could not download the update",
                "无法下载更新",
                "無法下載更新",
                "업데이트를 다운로드할 수 없습니다",
            ],
            error,
        )
    })?;
    // 入れ替えの前に、同梱の Node.js で動くランナーを止める（動いたままだとファイルを置き換えられない）
    before.run().await;
    update.install(bytes).map_err(|error| {
        failed(
            [
                "更新を入れられませんでした。アプリを起動し直してください",
                "Could not install the update. Restart the app",
                "无法安装更新。请重新启动应用",
                "無法安裝更新。請重新啟動應用程式",
                "업데이트를 설치할 수 없습니다. 앱을 다시 시작하십시오",
            ],
            error,
        )
    })?;
    app.request_restart();
    Ok(())
}

async fn find_update(app: &AppHandle) -> CommandResult<Option<Update>> {
    let updater = app.updater().map_err(|error| failed(CHECK_FAILED, error))?;
    updater.check().await.map_err(|error| failed(CHECK_FAILED, error))
}

const CHECK_FAILED: [&str; 5] = [
    "更新を確認できませんでした",
    "Could not check for updates",
    "无法检查更新",
    "無法檢查更新",
    "업데이트를 확인할 수 없습니다",
];

/// what は失敗した操作（日本語・英語・簡体字・繁体字・韓国語の順）
fn failed(what: [&str; 5], error: impl std::fmt::Display) -> guild_domain::error::CommandError {
    let what = locale::pick(what);
    let message = locale::pick([
        format!("{what}（{error}）"),
        format!("{what} ({error})"),
        format!("{what}（{error}）"),
        format!("{what}（{error}）"),
        format!("{what}({error})"),
    ]);
    reject(AppError::Unavailable(message))
}
