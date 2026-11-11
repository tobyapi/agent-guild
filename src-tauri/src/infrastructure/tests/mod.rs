//! アダプタのテスト（ファイルシステムを使うものは一時フォルダを使い、最後に消す）。

mod clock;
mod data_folder;
mod export;
mod path_components;
mod settings_workspace;
mod skill_library;

use std::fs;
use std::path::PathBuf;

/// 一意な一時フォルダ
pub(super) struct TempDir(pub PathBuf);

impl TempDir {
    pub fn new(name: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("guild-infra-{name}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
