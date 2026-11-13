//! データフォルダの場所の決定（design.md §11 の 1）:
//! 環境変数 GUILD_DATA_DIR > <app_config_dir>/settings.json の dataDir > 既定（<app_local_data_dir>/data）。

use std::path::{Path, PathBuf};

use guild_domain::storage::{StorageInfo, StorageSource};
use tauri::{AppHandle, Manager};

use crate::infrastructure::settings::SettingsFile;

pub struct AppPaths {
    /// settings.json を置く場所
    pub config_dir: PathBuf,
    pub default_data_dir: PathBuf,
    /// いま使うデータフォルダ
    pub data_dir: PathBuf,
    pub source: StorageSource,
    /// アプリのリソースのフォルダ（配布版では同梱の runner がある。分からなければ None）
    pub resource_dir: Option<PathBuf>,
}

impl AppPaths {
    pub fn storage_info(&self) -> StorageInfo {
        StorageInfo {
            data_dir: self.data_dir.display().to_string(),
            default_data_dir: self.default_data_dir.display().to_string(),
            source: self.source,
        }
    }
}

pub fn resolve(app: &AppHandle) -> tauri::Result<AppPaths> {
    // 開発版は GUILD_CONFIG_DIR で設定ファイルも本番環境から分離できる
    let config_dir = std::env::var_os("GUILD_CONFIG_DIR")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .map(Ok)
        .unwrap_or_else(|| app.path().app_config_dir())?;
    // app_local_data_dir の直下には WebView2 のプロファイル（EBWebView）が置かれるので、サブフォルダを使う
    let default_data_dir = app.path().app_local_data_dir()?.join("data");
    let (data_dir, source) = choose(&config_dir, &default_data_dir);
    let resource_dir = app.path().resource_dir().ok();
    Ok(AppPaths { config_dir, default_data_dir, data_dir, source, resource_dir })
}

fn choose(config_dir: &Path, default_data_dir: &Path) -> (PathBuf, StorageSource) {
    if let Some(dir) = std::env::var_os("GUILD_DATA_DIR").filter(|value| !value.is_empty()) {
        let dir = PathBuf::from(dir);
        return (std::path::absolute(&dir).unwrap_or(dir), StorageSource::Env);
    }
    match SettingsFile::in_dir(config_dir).data_dir() {
        Ok(Some(dir)) => (dir, StorageSource::Settings),
        Ok(None) => (default_data_dir.to_path_buf(), StorageSource::Default),
        Err(reason) => {
            log::warn!("起動設定を読めないため、既定のデータフォルダを使います: {reason}");
            (default_data_dir.to_path_buf(), StorageSource::Default)
        }
    }
}
