//! スキルライブラリのフォルダを読むポート（書き換えない）。SKILL.md の解釈は guild-domain の純粋関数で行う。

use std::path::{Path, PathBuf};

/// 走査で見つけたスキル（SKILL.md があるフォルダ1つ）
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FoundSkill {
    pub folder: PathBuf,
    /// SKILL.md 以外の付属ファイルの数
    pub file_count: u32,
    /// SKILL.md の中身
    pub text: Result<String, SkillFileError>,
}

/// ライブラリのフォルダ1つを走査した結果
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct DirScan {
    pub skills: Vec<FoundSkill>,
    /// 上限に達して打ち切った
    pub truncated: bool,
}

/// ライブラリのフォルダの問題（使用者向けの日本語）
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum DirProblem {
    #[error("フォルダが見つかりません")]
    Missing,
    #[error("フォルダではありません")]
    NotFolder,
    #[error("フォルダを読めません（{0}）")]
    Unreadable(String),
}

/// スキルのフォルダの SKILL.md を読めない理由（使用者向けの日本語）
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SkillFileError {
    #[error("フォルダが見つかりません")]
    FolderMissing,
    #[error("SKILL.md が見つかりません")]
    FileMissing,
    #[error("SKILL.md を読めません（{0}）")]
    Unreadable(String),
}

pub trait SkillLibraryScanner: Send + Sync {
    /// ライブラリのフォルダを走査する（深さは guild_domain::skill::LIBRARY_SCAN_DEPTH まで。
    /// `.git`・`node_modules`・隠しフォルダ・シンボリックリンクはたどらない）。limit 件見つけたら打ち切る
    fn scan(&self, dir: &Path, limit: usize) -> Result<DirScan, DirProblem>;
    /// スキルのフォルダの SKILL.md を読む
    fn read_skill_file(&self, folder: &Path) -> Result<String, SkillFileError>;
    /// フォルダとして存在するか（シンボリックリンクの先がフォルダでもよい）
    fn is_folder(&self, path: &Path) -> bool;
}
