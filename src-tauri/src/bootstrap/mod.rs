//! 組み立て役（composition root）: データフォルダの決定 → 言語 → ロック → DB → ランナー → サービス → 初期データ → スケジューラ。
//! データフォルダを開けなければ、サービスを起動せずに復旧モードで立ち上がる（design.md §11）。

mod assemble;
mod boot;
mod paths;
mod scheduler;
mod seed;

#[cfg(test)]
mod tests;

use std::error::Error;
use std::sync::Arc;
use std::time::Duration;

use guild_application::ports::SettingsStore;
use guild_domain::locale::{self, Language};
use tauri::{AppHandle, Manager};

use crate::infrastructure::logging;
use crate::infrastructure::runtime::RunnerRuntime;
use crate::infrastructure::settings::SettingsFile;

/// 終了時にランナーへ shutdown を送って待つ上限
const SHUTDOWN_WAIT: Duration = Duration::from_secs(5);

/// Tauri の setup から呼ぶ。通常時か復旧モードの AppState を State に入れる
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn Error>> {
    let handle = app.handle().clone();
    if let Some(file) = logging::init(handle.path().app_log_dir().ok().as_deref()) {
        log::info!("ログ: {}", file.display());
    }
    let paths = paths::resolve(&handle)?;
    log::info!("データフォルダ: {}（{:?}）", paths.data_dir.display(), paths.source);
    // 利用者に見える文字列（復旧モードの理由を含む）を作る前に、いまの言語を決める
    let language = saved_language(&paths.config_dir);
    locale::set_current(language.unwrap_or_default());
    let state = match boot::open(&paths) {
        Ok(opened) => assemble::ready(&handle, &paths, opened, language)?,
        Err(boot) => {
            log::warn!("データフォルダを開けないため、復旧モードで起動します: {:?} {}", boot.reason, boot.message);
            assemble::recovery(&handle, &paths, boot.with_language(language))
        }
    };
    app.manage(state);
    Ok(())
}

/// settings.json に保存した言語（まだ選んでいない・読めなければ None）
fn saved_language(config_dir: &std::path::Path) -> Option<Language> {
    match SettingsFile::in_dir(config_dir).load() {
        Ok(settings) => settings.language,
        Err(error) => {
            log::warn!("起動設定を読めないため、言語は日本語にします: {error}");
            None
        }
    }
}

/// アプリの終了時（再起動を含む）: ランナーに shutdown を送る
pub fn shutdown(app: &AppHandle) {
    tauri::async_runtime::block_on(stop_runner(app.clone()));
}

/// ランナーに shutdown を送って、終わるのを待つ（終了時と、更新を入れる直前）
pub async fn stop_runner(app: AppHandle) {
    let Some(runner) = app.try_state::<Arc<RunnerRuntime>>().map(|runner| Arc::clone(&runner)) else {
        return;
    };
    if tokio::time::timeout(SHUTDOWN_WAIT, runner.shutdown()).await.is_err() {
        log::warn!("ランナーの終了を待ちきれませんでした");
    }
}
