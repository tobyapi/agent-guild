//! git worktree（作業用フォルダ）の置き場。settings.json の worktreeHome に保存し、空なら <データフォルダ>/worktrees を使う。
//! エージェントにはプロンプトで置き場を伝える（prompt/worktree.rs）。
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::{error::ValidationError, locale};

/// 既定の置き場のフォルダ名（データフォルダの直下）
pub const DEFAULT_WORKTREE_DIR: &str = "worktrees";

/// 設定画面に出す置き場
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeHome {
    /// 利用者が設定した置き場（None なら既定）
    pub path: Option<String>,
    /// 既定の置き場（<データフォルダ>/worktrees）
    pub default_path: String,
}

impl WorktreeHome {
    /// 実際に使う置き場
    pub fn effective(&self) -> &str {
        self.path.as_deref().unwrap_or(&self.default_path)
    }
}

/// 前後の空白を除き、空なら None（既定に戻す）。絶対パスでなければ拒否する（field `path`）
pub fn normalize_worktree_home(input: Option<&str>) -> Result<Option<String>, ValidationError> {
    let Some(path) = input.map(str::trim).filter(|path| !path.is_empty()) else {
        return Ok(None);
    };
    if !Path::new(path).is_absolute() {
        return Err(ValidationError::on(
            "path",
            locale::pick([
                "作業用フォルダの置き場は、絶対パスで入力してください（例: D:\\worktrees）。",
                "Enter the worktree folder as an absolute path (for example, D:\\worktrees).",
                "请输入工作树文件夹的绝对路径（例如 D:\\worktrees）。",
                "請輸入工作樹資料夾的絕對路徑（例如 D:\\worktrees）。",
                "작업용 폴더 위치는 절대 경로로 입력하세요(예: D:\\worktrees).",
            ]),
        ));
    }
    Ok(Some(path.to_owned()))
}
