//! git worktree の置き場の保存と、実行時の読み直し。保存した置き場を次の実行のプロンプトから使う。
use std::path::{Path, PathBuf};
use std::sync::Arc;

use guild_domain::worktree_home::{normalize_worktree_home, WorktreeHome, DEFAULT_WORKTREE_DIR};

use crate::ports::SettingsStore;
use crate::AppResult;

#[derive(Clone)]
pub struct WorktreeHomeService {
    settings: Arc<dyn SettingsStore>,
    /// 既定の置き場（<データフォルダ>/worktrees。起動中はデータフォルダが変わらない）
    default_path: PathBuf,
}

impl WorktreeHomeService {
    pub fn new(settings: Arc<dyn SettingsStore>, data_dir: &Path) -> Self {
        Self { settings, default_path: data_dir.join(DEFAULT_WORKTREE_DIR) }
    }

    /// 画面に出す置き場。手で書いた値が絶対パスでなければ None（既定）にして、プロンプトに入る effective() と揃える
    pub fn get(&self) -> AppResult<WorktreeHome> {
        let saved = self.settings.load()?.worktree_home;
        Ok(WorktreeHome {
            path: normalize_worktree_home(saved.as_deref()).unwrap_or(None),
            default_path: self.default_path.display().to_string(),
        })
    }

    /// 空（None・空白だけ）なら既定に戻す。絶対パスでなければ validation（field `path`）
    pub fn set(&self, path: Option<String>) -> AppResult<()> {
        let path = normalize_worktree_home(path.as_deref())?;
        self.settings.update(Box::new(move |settings| settings.worktree_home = path))
    }

    /// プロンプトに入れる置き場。設定を読めない・手で書いた値が絶対パスでなければ既定を使う
    pub fn effective(&self) -> String {
        let saved =
            self.settings.load().and_then(|settings| Ok(normalize_worktree_home(settings.worktree_home.as_deref())?));
        match saved {
            Ok(Some(path)) => path,
            Ok(None) => self.default_path.display().to_string(),
            Err(error) => {
                log::warn!("作業用フォルダの置き場の設定を使わず、既定を使います: {error}");
                self.default_path.display().to_string()
            }
        }
    }
}
